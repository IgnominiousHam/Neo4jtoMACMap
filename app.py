from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from neo4j import GraphDatabase
import webbrowser
import os
import sys

def resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

app = Flask(__name__)
app.secret_key = os.urandom(24)

def get_driver():
    uri = session.get("NEO4J_URI", "bolt://localhost:7687")
    user = session.get("NEO4J_USER", "neo4j")
    password = session.get("NEO4J_PASS", "password")
    return GraphDatabase.driver(uri, auth=(user, password))

@app.route("/connect", methods=["GET", "POST"])
def connect():
    error = None
    if request.method == "POST":
        session["NEO4J_URI"] = request.form["uri"]
        session["NEO4J_USER"] = request.form["user"]
        session["NEO4J_PASS"] = request.form["password"]
        try:
            with get_driver().session() as s:
                s.run("RETURN 1")
            return redirect(url_for("index"))
        except Exception as e:
            error = "Could not connect to Neo4j: " + str(e)
    return render_template("connect.html", error=error)

@app.route("/")
def index():
    if not session.get("NEO4J_URI"):
        return redirect(url_for("connect"))
    return render_template("index.html")

@app.route("/query", methods=["POST"])
def query():
    data = request.json
    top_lat = float(data["topLat"])
    top_lon = float(data["topLon"])
    bottom_lat = float(data["bottomLat"])
    bottom_lon = float(data["bottomLon"])

    query = """
    MATCH (b:MAC)-[:SEEN_AT]->(a:Location)
    WHERE point.withinBBox(
        a.location,
        point({latitude: $bottom_lat, longitude: $bottom_lon}),
        point({latitude: $top_lat, longitude: $top_lon})
    )
    RETURN a.location AS location, b.address AS mac, a.name AS name
    """

    with get_driver().session() as session_neo:
        results = session_neo.run(query, {
            "top_lat": top_lat,
            "top_lon": top_lon,
            "bottom_lat": bottom_lat,
            "bottom_lon": bottom_lon
        })

        data = [
            {
                "lat": rec["location"].latitude,
                "lon": rec["location"].longitude,
                "mac": rec["mac"],
                "name": rec["name"]
            }
            for rec in results
        ]

    return jsonify(data)

@app.route('/mac_location', methods=['POST'])
def mac_location():
    data = request.get_json()
    mac_address = data.get('mac_address')
    if not mac_address:
        return jsonify({'error': 'No MAC address provided'}), 400

    cypher = """
    MATCH (b:MAC {address:$neodash_mac_address})-[:SEEN_AT]->(a:Location)
    RETURN a.location AS location
    """
    with get_driver().session() as session_neo:
        results = session_neo.run(cypher, neodash_mac_address=mac_address)
        locations = [
            {'lat': rec['location'].latitude, 'lon': rec['location'].longitude}
            for rec in results if rec['location']
        ]
        if locations:
            return jsonify(locations)
        return jsonify([]), 404

@app.route('/macs')
def macs():
    cypher = "MATCH (b:MAC)-[:SEEN_AT]->(a:Location) RETURN b.address AS address"
    with get_driver().session() as session_neo:
        results = session_neo.run(cypher)
        macs = [rec["address"] for rec in results if rec["address"]]
    return jsonify(macs)

@app.route('/mac_summary', methods=['POST'])
def mac_summary():
    data = request.get_json()
    mac_address = data.get('mac_address')
    if not mac_address:
        return jsonify({'error': 'No MAC address provided'}), 400

    cypher = """
    MATCH (b:MAC {address:$mac_address})-[r]->(n)
    WHERE type(r) <> 'SEEN_AT' and type(r) <> 'PROBE_RESPONSE_TO' and type(r) <> 'COMMUNICATES_WITH' and type(r) <> 'MULTICASTS_TO'
    RETURN type(r) AS rel_type, labels(n) AS node_labels, n
    """
    with get_driver().session() as session_neo:
        results = session_neo.run(cypher, mac_address=mac_address)
        summary = []
        for rec in results:
            node = rec['n']
            summary.append({
                'relationship': rec['rel_type'],
                'node_labels': rec['node_labels'],
                'properties': dict(node)
            })
    return jsonify(summary)

@app.route('/vendors_in_box', methods=['POST'])
def vendors_in_box():
    data = request.get_json()
    top_lat = float(data["topLat"])
    top_lon = float(data["topLon"])
    bottom_lat = float(data["bottomLat"])
    bottom_lon = float(data["bottomLon"])

    cypher = """
    MATCH (b:MAC)-[:SEEN_AT]->(a:Location)
    WHERE point.withinBBox(
        a.location,
        point({latitude: $bottom_lat, longitude: $bottom_lon}),
        point({latitude: $top_lat, longitude: $top_lon})
    )
    WITH DISTINCT b
    OPTIONAL MATCH (b)-[:HAS_VENDOR]->(v:Vendor)
    OPTIONAL MATCH (b)-[:BROADCASTS]->(s:SSID)
    OPTIONAL MATCH (b)-[:HAS_HOSTNAME]->(h:Hostname)
    RETURN coalesce(v.name, 'Unknown') AS vendor, count(DISTINCT b) AS count,
           collect(DISTINCT b.address) AS macs,
           collect(DISTINCT s.name) AS ssids,
           collect(DISTINCT h.hostname) AS hostnames
    """

    with get_driver().session() as session_neo:
        results = session_neo.run(cypher, {
            "top_lat": top_lat,
            "top_lon": top_lon,
            "bottom_lat": bottom_lat,
            "bottom_lon": bottom_lon
        })
        vendor_counts = []
        total = 0
        all_macs = set()
        all_ssids = set()
        all_hostnames = set()
        for rec in results:
            vendor_counts.append({
                "vendor": rec["vendor"],
                "count": rec["count"],
                "macs": rec["macs"],
                "ssids": rec["ssids"],
                "hostnames": rec["hostnames"]
            })
            total += rec["count"]
            all_macs.update(rec["macs"])
            all_ssids.update(rec["ssids"])
            all_hostnames.update(rec["hostnames"])
    return jsonify({
        "vendors": vendor_counts,
        "total": total,
        "all_macs": list(all_macs),
        "all_ssids": list(all_ssids),
        "all_hostnames": list(all_hostnames)
    })

if __name__ == "__main__":
    webbrowser.open("http://localhost:5000/")
    app.run(debug=True)