//! plays-like distance for disc golf holes.
//!
//! GET /plays-like?from_lat=..&from_lon=..&from_ele_ft=..&to_lat=..&to_lon=..&to_ele_ft=..
//! returns horizontal feet, elevation change, and plays-like feet.
//!
//! model v0: uphill adds the full climb, downhill credits half the drop.
//! calibrate against 3DEP hole profiles + ground truth once pins land.

use lambda_http::{run, service_fn, Body, Error, Request, RequestExt, Response};
use serde::Serialize;

/// mean earth radius in feet (6_371_000 m).
const EARTH_RADIUS_FT: f64 = 20_902_231.0;

fn haversine_ft(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_FT * a.sqrt().asin()
}

fn plays_like_ft(horizontal_ft: f64, elev_change_ft: f64) -> f64 {
    if elev_change_ft >= 0.0 {
        horizontal_ft + elev_change_ft
    } else {
        horizontal_ft + elev_change_ft * 0.5
    }
}

#[derive(Serialize)]
struct DistanceReply {
    horizontal_ft: f64,
    elev_change_ft: f64,
    plays_like_ft: f64,
    model: &'static str,
}

fn param(
    query: &lambda_http::aws_lambda_events::query_map::QueryMap,
    key: &str,
) -> Result<f64, String> {
    query
        .first(key)
        .ok_or_else(|| format!("missing query param: {key}"))?
        .parse::<f64>()
        .map_err(|_| format!("bad number for query param: {key}"))
}

async fn handler(event: Request) -> Result<Response<Body>, Error> {
    let query = event.query_string_parameters();
    let get = |k: &str| param(&query, k);
    let from_lat = get("from_lat").map_err(|m| format!("400 {m}"))?;
    let from_lon = get("from_lon").map_err(|m| format!("400 {m}"))?;
    let from_ele = get("from_ele_ft").map_err(|m| format!("400 {m}"))?;
    let to_lat = get("to_lat").map_err(|m| format!("400 {m}"))?;
    let to_lon = get("to_lon").map_err(|m| format!("400 {m}"))?;
    let to_ele = get("to_ele_ft").map_err(|m| format!("400 {m}"))?;

    let horizontal_ft = haversine_ft(from_lat, from_lon, to_lat, to_lon);
    let elev_change_ft = to_ele - from_ele;
    let reply = DistanceReply {
        horizontal_ft,
        elev_change_ft,
        plays_like_ft: plays_like_ft(horizontal_ft, elev_change_ft),
        model: "v0-uphill-full-downhill-half",
    };
    let body = serde_json::to_string(&reply)?;
    Ok(Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .body(body.into())
        .map_err(Box::new)?)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_point_is_zero() {
        assert_eq!(
            haversine_ft(32.95787, -105.73887, 32.95787, -105.73887),
            0.0
        );
    }

    #[test]
    fn thousandth_of_a_degree_lat_is_about_365ft() {
        // 0.001 deg lat = 111.32 m = 365.3 ft.
        let d = haversine_ft(32.95787, -105.73887, 32.95887, -105.73887);
        assert!((d - 365.3).abs() < 0.5, "got {d}");
    }

    #[test]
    fn flat_hole_plays_itself() {
        assert_eq!(plays_like_ft(134.0, 0.0), 134.0);
    }

    #[test]
    fn uphill_adds_full_climb() {
        assert_eq!(plays_like_ft(300.0, 40.0), 340.0);
    }

    #[test]
    fn downhill_credits_half_drop() {
        assert_eq!(plays_like_ft(300.0, -80.0), 260.0);
    }
}
