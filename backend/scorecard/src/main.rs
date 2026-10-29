//! scorecard API: per-round, per-hole scores in DynamoDB.
//!
//! POST /scorecard  body {round_id, entry, ...fields} -> stores one entry.
//!   entry is "meta" (round header: course, device_id, started_at) or
//!   "hole#NN" (hole score: hole, strokes, putts).
//! GET /scorecard?round_id=X -> {round_id, entries: [...]} for the round.
//!
//! v1 has no user login: rounds are namespaced by client-chosen round_id
//! (device id + timestamp). table: SCORECARD_TABLE env, PK round_id + SK entry.

use aws_sdk_dynamodb::{types::AttributeValue, Client};
use lambda_http::{run, service_fn, Body, Error, Request, RequestExt, Response};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::OnceCell;

static CLIENT: OnceCell<Client> = OnceCell::const_new();

async fn client() -> &'static Client {
    CLIENT
        .get_or_init(|| async {
            let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
            Client::new(&config)
        })
        .await
}

fn table() -> String {
    std::env::var("SCORECARD_TABLE").unwrap_or_else(|_| "cloudcroft-disc-golf-scorecards".into())
}

#[derive(Debug, Deserialize)]
struct PostBody {
    round_id: String,
    entry: String,
    #[serde(flatten)]
    extra: HashMap<String, serde_json::Value>,
}

fn json_value_to_attr(v: &serde_json::Value) -> AttributeValue {
    match v {
        serde_json::Value::String(s) => AttributeValue::S(s.clone()),
        serde_json::Value::Number(n) => AttributeValue::N(n.to_string()),
        serde_json::Value::Bool(b) => AttributeValue::Bool(*b),
        serde_json::Value::Null => AttributeValue::Null(true),
        serde_json::Value::Array(items) => {
            AttributeValue::L(items.iter().map(json_value_to_attr).collect())
        }
        serde_json::Value::Object(map) => AttributeValue::M(
            map.iter()
                .map(|(k, v)| (k.clone(), json_value_to_attr(v)))
                .collect(),
        ),
    }
}

fn attr_to_json(a: &AttributeValue) -> serde_json::Value {
    match a {
        AttributeValue::S(s) => serde_json::Value::String(s.clone()),
        AttributeValue::N(n) => n
            .parse::<i64>()
            .map(serde_json::Value::from)
            .unwrap_or_else(|_| serde_json::Value::String(n.clone())),
        AttributeValue::Bool(b) => serde_json::Value::Bool(*b),
        AttributeValue::Null(_) => serde_json::Value::Null,
        AttributeValue::L(items) => items.iter().map(attr_to_json).collect(),
        AttributeValue::M(map) => map
            .iter()
            .map(|(k, v)| (k.clone(), attr_to_json(v)))
            .collect(),
        _ => serde_json::Value::Null,
    }
}

fn reply(status: u16, body: &str) -> Result<Response<Body>, Error> {
    Ok(Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(body.to_owned().into())
        .map_err(Box::new)?)
}

fn validate_post(body: &PostBody) -> Result<(), String> {
    if body.round_id.trim().is_empty() {
        return Err("round_id must not be empty".into());
    }
    if body.round_id.len() > 128 || body.entry.len() > 128 {
        return Err("round_id/entry too long (max 128)".into());
    }
    let entry_ok = body.entry == "meta"
        || (body.entry.len() == 7
            && body.entry.starts_with("hole#")
            && body.entry[5..].parse::<u32>().is_ok());
    if !entry_ok {
        return Err("entry must be \"meta\" or \"hole#NN\"".into());
    }
    Ok(())
}

async fn handle_post(event: &Request) -> Result<Response<Body>, Error> {
    let parsed: PostBody = match serde_json::from_slice(event.body()) {
        Ok(b) => b,
        Err(_) => return reply(400, r#"{"error":"invalid JSON body"}"#),
    };
    if let Err(msg) = validate_post(&parsed) {
        return reply(
            400,
            &serde_json::to_string(&serde_json::json!({"error": msg}))?,
        );
    }
    let mut item = HashMap::from([
        ("round_id".to_owned(), AttributeValue::S(parsed.round_id)),
        ("entry".to_owned(), AttributeValue::S(parsed.entry)),
    ]);
    for (k, v) in &parsed.extra {
        item.insert(k.clone(), json_value_to_attr(v));
    }
    client()
        .await
        .put_item()
        .table_name(table())
        .set_item(Some(item))
        .send()
        .await
        .map_err(|e| format!("dynamo put failed: {e}"))?;
    reply(201, r#"{"ok":true}"#)
}

async fn handle_get(event: &Request) -> Result<Response<Body>, Error> {
    let query = event.query_string_parameters();
    let round_id = match query.first("round_id") {
        Some(id) if !id.is_empty() => id.to_owned(),
        _ => return reply(400, r#"{"error":"missing query param: round_id"}"#),
    };
    let out = client()
        .await
        .query()
        .table_name(table())
        .key_condition_expression("round_id = :r")
        .expression_attribute_values(":r", AttributeValue::S(round_id.to_owned()))
        .send()
        .await
        .map_err(|e| format!("dynamo query failed: {e}"))?;
    #[derive(Serialize)]
    struct Round {
        round_id: String,
        entries: Vec<HashMap<String, serde_json::Value>>,
    }
    let entries = out
        .items()
        .iter()
        .map(|item| {
            item.iter()
                .map(|(k, v)| (k.clone(), attr_to_json(v)))
                .collect()
        })
        .collect();
    let body = serde_json::to_string(&Round {
        round_id: round_id.to_owned(),
        entries,
    })?;
    reply(200, &body)
}

async fn handler(event: Request) -> Result<Response<Body>, Error> {
    match event.method().as_str() {
        "POST" => handle_post(&event).await,
        "GET" => handle_get(&event).await,
        m => reply(405, &format!(r#"{{"error":"method not allowed: {m}"}}"#)),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn post(round_id: &str, entry: &str) -> PostBody {
        PostBody {
            round_id: round_id.into(),
            entry: entry.into(),
            extra: HashMap::new(),
        }
    }

    #[test]
    fn meta_entry_valid() {
        assert!(validate_post(&post("r1", "meta")).is_ok());
    }

    #[test]
    fn hole_entry_valid() {
        assert!(validate_post(&post("r1", "hole#03")).is_ok());
    }

    #[test]
    fn bad_entry_rejected() {
        assert!(validate_post(&post("r1", "hole3")).is_err());
        assert!(validate_post(&post("r1", "bogus")).is_err());
    }

    #[test]
    fn empty_round_rejected() {
        assert!(validate_post(&post("", "meta")).is_err());
        assert!(validate_post(&post("   ", "meta")).is_err());
    }

    #[test]
    fn attr_round_trip() {
        let v = serde_json::json!({"a": "x", "n": 4, "b": true, "l": [1, 2]});
        let back = attr_to_json(&json_value_to_attr(&v));
        assert_eq!(back, v);
    }
}
