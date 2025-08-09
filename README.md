# 🐋 Neo4jtoMACMap

**Neo4jtoMACMap** is a Python/Flask-based web application that maps data from a Neo4j database generated from PCAP network captures (see [PCAPtoNeo4j](https://github.com/IgnominiousHam/PCAPtoNeo4j) for initial processing).  

---

## 🚀 Features

- **🌐 Interactive Web Interface** – View and explore data from a Neo4j PCAP database in your browser.
- **🗺️ MAC Mapping** – Draw a bounding box or query on a single MAC address to see location data on a Leaflet map.
- **📡 Relationship Queries** – Visualize relationships between MACs, IPs, SSIDs, and communication patterns.   
- **🖥️ Standalone Executable** – Built with PyInstaller for easy distribution.

---

## ⚙️ How It Works

1. Capture network traffic in PCAP/PCAPPPI format with GPS enabled.
2. Import files into Neo4j using [PCAPtoNeo4j](https://github.com/IgnominiousHam/PCAPtoNeo4j).  
3. Launch **Neo4jtoMACMap** to connect to Neo4j and start mapping data.

---

## 🛠️ Installation

### From Source
```bash
git clone https://github.com/yourusername/Neo4jtoMACMap.git
cd Neo4jtoMACMap
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### From Executable (Windows)

Download neo4jtomacmap.exe from the Releases page and run it.
