import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Layers, Navigation, ZoomIn, ZoomOut, Check } from 'lucide-react';

/**
 * Enhanced Leaflet Map Component with High Place Visibility
 * Features:
 * - High-definition CartoDB Voyager tiles for crisp place names, POIs, building footprints, and streets
 * - Layer Switcher (Detailed Places & Streets, OpenStreetMap, Satellite Imagery)
 * - Place & Landmark Search (Nominatim Geocoding)
 * - Metric scale bar for real-world distance reference
 * - Dynamic workplace circle that resizes live when admin changes radius (default 50m)
 * - Draggable workplace pin in editable mode
 * - Real GPS user location pin with accuracy perimeter and distance line
 */
export default function InteractiveMap({
  centerLat = 12.9715987,
  centerLon = 77.5945627,
  userLat = null,
  userLon = null,
  userAccuracy = null,
  radius = 50,
  editable = false,
  onCenterChange = null,
  height = '360px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userAccuracyRef = useRef(null);
  const distanceLineRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof window.L === 'undefined') {
      console.warn('Leaflet (window.L) is not yet loaded.');
      return;
    }

    const L = window.L;

    // Create map instance
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false, // We'll add custom positioned zoom control
        attributionControl: false
      }).setView([centerLat, centerLon], 18);

      // 1. High-definition Voyager Layer (Best for place names, building shapes, street labels)
      const voyager = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 20,
          subdomains: 'abcd'
        }
      ).addTo(map);

      // 2. OpenStreetMap Standard Layer
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      });

      // 3. Esri High-Resolution Satellite Layer
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19
        }
      );

      // Layer Control (Allows 1-click toggling between Places, OSM, and Satellite)
      const baseLayers = {
        '🗺️ Detailed Places & Streets': voyager,
        '🏙️ OpenStreetMap Standard': osm,
        '🛰️ Satellite Imagery': satellite
      };
      L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

      // Metric Scale Control (Shows exact real-world meters scale bar)
      L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

      // Zoom Control in top-left
      L.control.zoom({ position: 'topleft' }).addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size on load
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {}
      }, 250);

      // Handle map clicks in editable mode
      if (editable) {
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          if (onCenterChange) {
            onCenterChange(Number(lat.toFixed(7)), Number(lng.toFixed(7)));
          }
        });
      }
    }

    const map = mapInstanceRef.current;
    setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (e) {}
    }, 200);

    // 1. Center / Workplace Marker
    const officeIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="background: #2563eb; color: #ffffff; padding: 5px 10px; border-radius: 18px; font-weight: 700; font-size: 11px; white-space: nowrap; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; gap: 5px; border: 2px solid #ffffff;">
          🏢 Workplace Center
        </div>
      `,
      iconSize: [130, 30],
      iconAnchor: [65, 30]
    });

    if (!centerMarkerRef.current) {
      const marker = L.marker([centerLat, centerLon], {
        icon: officeIcon,
        draggable: editable
      }).addTo(map);

      if (editable) {
        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          if (onCenterChange) {
            onCenterChange(Number(pos.lat.toFixed(7)), Number(pos.lng.toFixed(7)));
          }
        });
      }

      centerMarkerRef.current = marker;
    } else {
      centerMarkerRef.current.setLatLng([centerLat, centerLon]);
      if (centerMarkerRef.current.dragging) {
        if (editable) centerMarkerRef.current.dragging.enable();
        else centerMarkerRef.current.dragging.disable();
      }
    }

    // 2. Dynamic Circular Geofence Polygon (Radius configurable by Admin)
    const currentRadius = Number(radius) || 50;
    if (!circleRef.current) {
      const circle = L.circle([centerLat, centerLon], {
        radius: currentRadius,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(map);

      circle.bindTooltip(`Workplace Geofence (${currentRadius}m)`, {
        permanent: false,
        direction: 'top'
      });

      circleRef.current = circle;
    } else {
      circleRef.current.setLatLng([centerLat, centerLon]);
      circleRef.current.setRadius(currentRadius);
      circleRef.current.setTooltipContent(`Workplace Geofence (${currentRadius}m)`);
    }

    // 3. User Real GPS Location Marker
    if (userLat !== null && userLon !== null) {
      const userIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div style="background: #10b981; color: #ffffff; padding: 5px 10px; border-radius: 18px; font-weight: 700; font-size: 11px; white-space: nowrap; box-shadow: 0 3px 8px rgba(16,185,129,0.5); display: flex; align-items: center; gap: 5px; border: 2px solid #ffffff;">
            📍 Your Real GPS
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 30]
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([userLat, userLon], { icon: userIcon }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([userLat, userLon]);
      }

      // GPS Accuracy Circle
      if (userAccuracy) {
        if (!userAccuracyRef.current) {
          userAccuracyRef.current = L.circle([userLat, userLon], {
            radius: userAccuracy,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.1,
            weight: 1
          }).addTo(map);
        } else {
          userAccuracyRef.current.setLatLng([userLat, userLon]);
          userAccuracyRef.current.setRadius(userAccuracy);
        }
      }

      // Distance line
      const latlngs = [
        [centerLat, centerLon],
        [userLat, userLon]
      ];
      if (!distanceLineRef.current) {
        distanceLineRef.current = L.polyline(latlngs, {
          color: '#64748b',
          weight: 2,
          dashArray: '6, 6'
        }).addTo(map);
      } else {
        distanceLineRef.current.setLatLngs(latlngs);
      }

      // Fit bounds to show both workplace center and user GPS
      try {
        const bounds = L.latLngBounds([
          [centerLat, centerLon],
          [userLat, userLon]
        ]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      } catch (e) {}
    } else {
      map.setView([centerLat, centerLon], 18);
    }
  }, [centerLat, centerLon, userLat, userLon, userAccuracy, radius, editable]);

  // Handle Place Search via Nominatim Geocoding API
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data || []);
      setShowResults(true);

      if (data && data.length > 0) {
        selectPlace(data[0]);
      }
    } catch (err) {
      console.warn('Place search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPlace = (place) => {
    const lat = Number(parseFloat(place.lat).toFixed(7));
    const lon = Number(parseFloat(place.lon).toFixed(7));

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 18, { duration: 1.2 });
    }

    if (editable && onCenterChange) {
      onCenterChange(lat, lon, place.display_name);
    }
    setShowResults(false);
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([centerLat, centerLon], 18);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}
    >
      {/* Map Search Bar for Places, Cities & Landmarks */}
      {editable && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '50px',
            zIndex: 1000,
            width: 'calc(100% - 170px)',
            maxWidth: '420px'
          }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 Search place, city, street, or landmark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 32px 7px 12px',
                fontSize: '0.8rem',
                border: '1px solid #94a3b8',
                borderRadius: '6px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                outline: 'none',
                background: '#ffffff',
                color: '#1e293b'
              }}
            />
            <button
              type="submit"
              disabled={isSearching}
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Search size={15} />
            </button>
          </form>

          {/* Autocomplete / Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: '#ffffff',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                maxHeight: '180px',
                overflowY: 'auto',
                zIndex: 1001
              }}
            >
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => selectPlace(item)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    color: '#334155'
                  }}
                  onMouseEnter={(e) => (e.target.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.target.style.background = '#ffffff')}
                >
                  <MapPin size={12} color="#2563eb" style={{ display: 'inline', marginRight: '6px' }} />
                  {item.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Radius Badge Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: editable ? '110px' : '10px',
          zIndex: 999,
          background: 'rgba(37, 99, 235, 0.9)',
          color: '#ffffff',
          padding: '4px 10px',
          borderRadius: '16px',
          fontSize: '0.72rem',
          fontWeight: 700,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span>Workplace Radius: {radius || 50}m</span>
      </div>

      {/* Recenter Button */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Center on Workplace"
        style={{
          position: 'absolute',
          bottom: editable ? '40px' : '12px',
          right: '12px',
          zIndex: 999,
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '6px',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Navigation size={16} />
      </button>

      {/* Leaflet DOM container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {editable && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '10px',
            right: '10px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: '#334155',
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            zIndex: 998,
            textAlign: 'center'
          }}
        >
          Click anywhere on the map or drag the pin to adjust workplace coordinates.
        </div>
      )}
    </div>
  );
}
