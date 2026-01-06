import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// ==================================================================
// 🔑 KEYS AREA - PASTE YOUR KEYS HERE
// ==================================================================
const WEATHER_API_KEY = 'bbb45c9270d4432388f173459260501';
const SUPABASE_URL = 'https://hztbhfvrecomlicipvfc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dGJoZnZyZWNvbWxpY2lwdmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MzY2MzcsImV4cCI6MjA4MzIxMjYzN30.IDFevYnTw_0TAVdKlY3kDSDRaZrzE3ybA9UNpOuMVRw';
// ==================================================================

// Initialize Database Connection
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const App = () => {
  // STATE: Form Inputs
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // STATE: Data
  const [currentWeather, setCurrentWeather] = useState(null);
  const [dbRecords, setDbRecords] = useState([]);
  
  // STATE: UI Handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [editText, setEditText] = useState('');

  // LOAD DATA ON STARTUP
  useEffect(() => {
    fetchRecords();
  }, []);

  // --- VALIDATION ---
  const validateInputs = () => {
    if (!location) return "Location is required.";
    if (!startDate || !endDate) return "Date range is required.";
    if (new Date(startDate) > new Date(endDate)) return "Start date cannot be after end date.";
    return null;
  };

  // --- MAIN SEARCH & SAVE ---
  const handleSearch = async (e) => {
    e.preventDefault();
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get Weather Data
      const response = await axios.get(`http://api.weatherapi.com/v1/forecast.json`, {
        params: { key: WEATHER_API_KEY, q: location, days: 3 }
      });

      const data = response.data;
      const tempString = `${data.current.temp_f}°F (${data.current.condition.text})`;
      const cleanLocation = `${data.location.name}, ${data.location.region}`;
      const dateRangeString = `${startDate} to ${endDate}`;

      setCurrentWeather({ ...data, cleanLocation, tempString });

      // 2. Save to Database (CREATE)
      await addRecord(cleanLocation, tempString, dateRangeString);

    } catch (err) {
      console.error(err);
      setError("Location not found or API error.");
    } finally {
      setLoading(false);
    }
  };

  // --- DATABASE FUNCTIONS (CRUD) ---

  // CREATE
  const addRecord = async (loc, temp, range) => {
    const { error } = await supabase
      .from('weather_logs')
      .insert([{ location: loc, temperature: temp, date_range: range, notes: 'Auto-saved' }]);

    if (error) console.error('Error adding:', error);
    else fetchRecords(); 
  };

  // READ
  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from('weather_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setDbRecords(data);
  };

  // UPDATE
  const updateRecord = async (id) => {
    const { error } = await supabase
      .from('weather_logs')
      .update({ notes: editText })
      .eq('id', id);

    if (!error) {
      setEditMode(null);
      fetchRecords();
    }
  };

  // DELETE
  const deleteRecord = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    
    const { error } = await supabase
      .from('weather_logs')
      .delete()
      .eq('id', id);

    if (!error) fetchRecords();
  };

  // --- EXPORT FUNCTION ---
  const exportJSON = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(dbRecords))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "weather_data.json";
    link.click();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Advanced Weather & Data Logger</h1>

      {/* SEARCH FORM */}
      <div style={styles.card}>
        <form onSubmit={handleSearch} style={styles.formGrid}>
          <input style={styles.input} placeholder="Location (e.g. Paris)" value={location} onChange={e => setLocation(e.target.value)} />
          <input style={styles.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <input style={styles.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button style={styles.btnPrimary} type="submit">Get Weather & Save</button>
        </form>
        {error && <p style={{color: 'red', textAlign: 'center'}}>{error}</p>}
      </div>

      {/* WEATHER DISPLAY + GOOGLE MAP */}
      {currentWeather && (
        <div style={styles.resultSection}>
          <div style={styles.weatherInfo}>
            <h2>{currentWeather.cleanLocation}</h2>
            <p style={{fontSize: '2rem', fontWeight: 'bold'}}>{currentWeather.tempString}</p>
            <img src={currentWeather.current.condition.icon} alt="icon" />
          </div>
          <iframe
            width="100%" height="250" style={{border:0, borderRadius: '8px'}} loading="lazy" allowFullScreen
            src={`https://maps.google.com/maps?q=${currentWeather.location.lat},${currentWeather.location.lon}&hl=es;z=14&output=embed`}
          ></iframe>
        </div>
      )}

      {/* DATABASE TABLE */}
      <div style={styles.historySection}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h3>Database Records (Supabase)</h3>
          <button onClick={exportJSON} style={styles.btnSecondary}>Export JSON</button>
        </div>

        {loading ? <p>Loading...</p> : (
          <table style={styles.table}>
            <thead>
              <tr style={{textAlign: 'left', background: '#eee'}}>
                <th style={{padding: '10px'}}>Location</th>
                <th>Dates</th>
                <th>Temp</th>
                <th>Notes (Editable)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dbRecords.map(record => (
                <tr key={record.id} style={{borderBottom: '1px solid #ddd'}}>
                  <td style={{padding: '10px'}}>{record.location}</td>
                  <td>{record.date_range}</td>
                  <td>{record.temperature}</td>
                  <td>
                    {editMode === record.id ? (
                      <input value={editText} onChange={e => setEditText(e.target.value)} style={styles.inputSmall} />
                    ) : record.notes}
                  </td>
                  <td>
                    {editMode === record.id ? (
                      <button onClick={() => updateRecord(record.id)} style={styles.btnSave}>Save</button>
                    ) : (
                      <>
                        <button onClick={() => { setEditMode(record.id); setEditText(record.notes); }} style={styles.btnEdit}>Edit</button>
                        <button onClick={() => deleteRecord(record.id)} style={styles.btnDelete}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' },
  header: { textAlign: 'center', color: '#333' },
  card: { background: '#f4f4f4', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  inputSmall: { padding: '5px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' },
  btnPrimary: { padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnSecondary: { padding: '5px 15px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnEdit: { marginRight: '5px', cursor: 'pointer', background: 'none', border: 'none', color: 'blue', textDecoration: 'underline' },
  btnSave: { marginRight: '5px', cursor: 'pointer', background: 'none', border: 'none', color: 'green', fontWeight: 'bold' },
  btnDelete: { cursor: 'pointer', background: 'none', border: 'none', color: 'red', textDecoration: 'underline' },
  resultSection: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' },
  weatherInfo: { background: '#e3f2fd', padding: '20px', borderRadius: '8px', textAlign: 'center' },
  historySection: { marginTop: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' }
};

export default App;