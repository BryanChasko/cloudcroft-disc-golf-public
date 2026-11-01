#!/usr/bin/env python3
"""swm2_to_geojson.py — extract SW Maps project backups into survey GeoJSON.

.swmz = zip of one .swm2 SQLite db + Photos/. The db holds feature_layers,
features (remarks carry name/par/notes), points (averaged fixes with
accuracy + compass), and photos attached per point.

Usage:
  python swm2_to_geojson.py <project.swm2> <Photos-dir> <out-dir>

Writes <out-dir>/points.geojson + copies attached photos to
<out-dir>/photos_attached/. Deterministic: rows ordered by (feature, seq).
"""
import json
import os
import shutil
import sqlite3
import sys


def main():
    db_path, photos_dir, out_dir = sys.argv[1:4]
    os.makedirs(out_dir, exist_ok=True)
    c = sqlite3.connect(db_path)
    layers = {r[0]: r[1] for r in c.execute("select uuid,name from feature_layers")}

    # resolve photo linkage: photos.uuid may key to features.uuid or points ids
    feat_ids = {r[0] for r in c.execute("select uuid from features")}
    pt_ids = set()
    for r in c.execute("select uuid,fid from points"):
        pt_ids.add(r[0])
        pt_ids.add(r[1])

    # features whose uuid matches a point session carry the remark for it
    feat_by_id = {
        r[0]: (r[1], r[2], r[3])
        for r in c.execute("select uuid,layer_id,name,remarks from features")
    }
    feats = []
    for p in c.execute(
        "select uuid,fid,seq,lat,lon,elv,bearing,accuracy_h,accuracy_v,"
        "pos_data,time from points order by time"
    ):
        p_uuid, fid, seq, lat, lon, elv, bearing, ah, av, pos, t = p
        try:
            pos = json.loads(pos) if pos else {}
        except ValueError:
            pos = {"raw": pos}
        avg = pos.get("AveragingCount") if isinstance(pos, dict) else None
        layer_id, fname, remarks = feat_by_id.get(
            fid, feat_by_id.get(p_uuid, ("", "", ""))
        )
        linked = [
            r[0]
            for r in c.execute("select photo_path from photos where uuid=?", (fid,))
        ]
        photo_remarks = [
            r[0]
            for r in c.execute("select remarks from photos where uuid=?", (fid,))
        ]
        copied = []
        for ph in linked:
            src = os.path.join(photos_dir, os.path.basename(ph))
            dst = os.path.join(out_dir, "photos_attached", os.path.basename(ph))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.isfile(src) and not os.path.isfile(dst):
                shutil.copy2(src, dst)
            copied.append(os.path.basename(ph))
        feats.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "layer": layers.get(layer_id, layer_id),
                    "feature": fname,
                    "remark": remarks,
                    "seq": seq,
                    "elevation_m": elv,
                    "compass_brg": bearing,
                    "accuracy_h_m": ah,
                    "accuracy_v_m": av,
                    "averaging": avg,
                    "sats_in_use": pos.get("SatellitesInUse"),
                    "photos": copied,
                    "photo_remarks": photo_remarks,
                },
            }
        )
    fc = {"type": "FeatureCollection", "features": feats}
    out = os.path.join(out_dir, "points.geojson")
    with open(out, "w") as fh:
        json.dump(fc, fh, indent=1)
        fh.write("\n")
    print(f"wrote {out}: {len(feats)} points")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("usage: swm2_to_geojson.py <project.swm2> <Photos-dir> <out-dir>")
    main()
