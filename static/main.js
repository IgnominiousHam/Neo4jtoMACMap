const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18,
  attribution: '© Esri'
});


// Set satellite as the default layer
const map = L.map('map', {
  center: [40.7128, -74.0060],
  zoom: 13,
  layers: [satellite]
});

const baseMaps = {
  "Street": street,
  "Satellite": satellite
};

L.control.layers(baseMaps).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: false,
    polyline: false,
    circle: false,
    marker: false,
    circlemarker: false,
    rectangle: true
  },
  edit: {
    featureGroup: drawnItems
  }
});
map.addControl(drawControl);

// Populate datalist
fetch('/macs')
  .then(res => res.json())
  .then(macs => {
    const datalist = document.getElementById('macs');
    macs.forEach(mac => {
      const option = document.createElement('option');
      option.value = mac;
      datalist.appendChild(option);
    });
  });

// Handle MAC input (on Enter or blur)
document.getElementById('macInput').addEventListener('change', function() {
  drawnItems.clearLayers();
  const mac = this.value.trim();
  if (!mac) return;

  // Fetch and display summary
  fetch('/mac_summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mac_address: mac })
  })
  .then(res => res.json())
  .then(summary => {
    const summaryDiv = document.getElementById('macSummary');
    if (Array.isArray(summary) && summary.length > 0) {
      summaryDiv.innerHTML = summary.map(item => `
        <div style="margin-bottom:10px;">
          <strong>${item.relationship}</strong> → <em>${item.node_labels.join(', ')}</em>
          <pre style="background:#1e293b;color:#bae6fd;padding:6px 8px;border-radius:6px;overflow-x:auto;">${JSON.stringify(item.properties, null, 2)}</pre>
        </div>
      `).join('');
    } else {
      summaryDiv.innerHTML = '<em>No relationships found for this MAC.</em>';
    }
  });

  fetch('/mac_location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mac_address: mac })
  })
  .then(res => res.json())
  .then(data => {
    if (Array.isArray(data) && data.length > 0) {
      data.forEach(loc => {
        const marker = L.circleMarker([loc.lat, loc.lon], {
          radius: 3,
          color: 'blue',
          fillColor: 'blue',
          fillOpacity: 0.7
        }).addTo(drawnItems);
        marker.bindPopup(`${mac}`);
      });
      const bounds = L.latLngBounds(data.map(loc => [loc.lat, loc.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      alert('Location not found for this MAC address.');
    }
  });
});

// Now this is outside the dropdown event handler:
map.on(L.Draw.Event.CREATED, function (event) {
  drawnItems.clearLayers();
  const layer = event.layer;
  drawnItems.addLayer(layer);

  const bounds = layer.getBounds();
  window.lastBoundingBox = {
    topLat: bounds.getNorth(),
    topLon: bounds.getEast(),
    bottomLat: bounds.getSouth(),
    bottomLon: bounds.getWest()
  };

  fetch('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topLat: bounds.getNorth(),
      topLon: bounds.getEast(),
      bottomLat: bounds.getSouth(),
      bottomLon: bounds.getWest()
    })
  })
  .then(res => res.json())
  .then(data => {
    // Assign a color to each unique MAC
    const macs = [...new Set(data.map(item => item.mac))];
    const colorPalette = [
      '#60a5fa', '#f59e42', '#34d399', '#f472b6', '#a78bfa', '#f87171', '#facc15', '#38bdf8', '#6366f1', '#10b981',
      '#eab308', '#ef4444', '#a3e635', '#f43f5e', '#818cf8', '#fbbf24', '#06b6d4', '#84cc16', '#e11d48', '#7c3aed'
    ];
    const macColorMap = {};
    macs.forEach((mac, idx) => {
      macColorMap[mac] = colorPalette[idx % colorPalette.length];
    });

    data.forEach(item => {
      const marker = L.circleMarker([item.lat, item.lon], {
        radius: 3,
        color: macColorMap[item.mac],
        fillColor: macColorMap[item.mac],
        fillOpacity: 0.7
      }).addTo(drawnItems);
      marker.bindPopup(item.mac || "No MAC");

      // Add click event to fetch and display MAC summary
      marker.on('click', function() {
        fetch('/mac_summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mac_address: item.mac })
        })
        .then(res => res.json())
        .then(summary => {
          const summaryDiv = document.getElementById('macSummary');
          if (Array.isArray(summary) && summary.length > 0) {
            summaryDiv.innerHTML = summary.map(s => `
              <div style="margin-bottom:10px;">
                <strong>${s.relationship}</strong> → <em>${s.node_labels.join(', ')}</em>
                <pre style="background:#1e293b;color:#bae6fd;padding:6px 8px;border-radius:6px;overflow-x:auto;">${JSON.stringify(s.properties, null, 2)}</pre>
              </div>
            `).join('');
          } else {
            summaryDiv.innerHTML = '<em>No relationships found for this MAC.</em>';
          }
        });
      });
    });
  })
  .catch(err => {
    console.error("Query failed:", err);
  });
});

// Fit map to all MAC locations only once on page load
fetch('/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topLat: 90,
    topLon: 180,
    bottomLat: -90,
    bottomLon: -180
  })
})
.then(res => res.json())
.then(data => {
  if (data.length > 0) {
    const bounds = L.latLngBounds(data.map(item => [item.lat, item.lon]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }
  // Hide the initializing overlay
  document.getElementById('mapInit').style.display = 'none';
});

document.getElementById('exportVendors').addEventListener('click', function() {
  if (!window.lastBoundingBox) {
    alert("Draw a bounding box first.");
    return;
  }
  fetch('/vendors_in_box', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(window.lastBoundingBox)
  })
  .then(res => res.json())
  .then(result => {
    // Filter out "Unknown" vendors and sort by count descending
    let vendorCounts = (result.vendors || []).filter(row => row.vendor !== "Unknown");
    vendorCounts = vendorCounts.sort((a, b) => b.count - a.count);
    const total = vendorCounts.reduce((sum, row) => sum + row.count, 0);
    if (!vendorCounts.length || total === 0) {
      alert("No vendor data to export.");
      return;
    }
    // Vendor table
    let csv = "Vendor,Count,Percentage\n";
    vendorCounts.forEach(row => {
      const percent = ((row.count / total) * 100).toFixed(2);
      csv += `"${row.vendor}",${row.count},${percent}\n`;
    });

    // List SSIDs vertically
    csv += "\nObserved SSIDs:\n";
    (result.all_ssids || []).forEach(ssid => {
      csv += ssid + "\n";
    });

   // List hostnames vertically
    csv += "\nObserved Hostnames:\n";
    (result.all_hostnames || []).forEach(hostname => {
      csv += hostname + "\n";
    });

    // List MACs vertically
    csv += "\nObserved MACs:\n";
    (result.all_macs || []).forEach(mac => {
      csv += mac + "\n";
    });


    // Limit decimals in filename to 4 places
    const bb = window.lastBoundingBox;
    function fmt(n) { return Number(n).toFixed(4); }
    const filename = `box_${fmt(bb.topLat)},${fmt(bb.topLon)}_${fmt(bb.bottomLat)},${fmt(bb.bottomLon)}.csv`;

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});
