import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// ==================================================================
// 🔑 KEYS CONFIGURED
// ==================================================================
const WEATHER_API_KEY = 'bbb45c9270d4432388f173459260501';
const SUPABASE_URL = 'https://hztbhfvrecomlicipvfc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dGJoZnZyZWNvbWxpY2lwdmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MzY2MzcsImV4cCI6MjA4MzIxMjYzN30.IDFevYnTw_0TAVdKlY3kDSDRaZrzE3ybA9UNpOuMVRw';

// 🗓️ DATE CONSTANTS
const MIN_API_DATE = '2010-01-01'; 
const MIN_YOUTUBE_YEAR = 2015;     
// ==================================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const App = () => {
  // --- STATE ---
  const [location, setLocation] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false); 
  
  // Weather & Forecast
  const [weather, setWeather] = useState(() => {
    const saved = localStorage.getItem('last_weather_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [customForecast, setCustomForecast] = useState([]);
  
  // Dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // DB & UI
  const [dbRecords, setDbRecords] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); 
  const [editMode, setEditMode] = useState(null);
  const [editText, setEditText] = useState('');

  // --- LIFECYCLE ---
  useEffect(() => {
    const link = document.createElement('link');
    link.href = "https://fonts.googleapis.com/css2?family=Chewy&family=Fredoka:wght@400;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    fetchRecords();
  }, []);

  // --- HELPERS ---
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getFutureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const getDatesInRange = (start, end) => {
    const dateArray = [];
    let currentDate = new Date(start);
    const stopDate = new Date(end);
    
    if (currentDate > stopDate) return [start];

    while (currentDate <= stopDate) {
      dateArray.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dateArray;
  };

  // --- GEOLOCATION ---
  const handleGeolocation = () => {
    setError(null); 
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `${position.coords.latitude},${position.coords.longitude}`;
          const startVal = getTodayDate();
          const endVal = getFutureDate(4); 
          setStartDate(startVal);
          setEndDate(endVal);
          fetchWeatherAndSave(coords, startVal, endVal);
        },
        (err) => {
          setError("Geolocation failed. Please enter location manually.");
          setLoading(false);
        }
      );
    }
  };

  // --- MAIN SEARCH ---
  const handleManualSubmit = (e) => {
    e.preventDefault();
    setError(null); 

    if (!location) {
      setError("Please enter a location or zip code.");
      return;
    }

    const startVal = startDate || getTodayDate();
    const endVal = endDate || startVal;
    const startObj = new Date(startVal);
    const endObj = new Date(endVal);
    const minObj = new Date(MIN_API_DATE);

    const diffTime = Math.abs(endObj - startObj);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays > 6) { 
       setError("⚠️ Limit Exceeded: Please select a range of 7 days or less.");
       return; 
    }

    if (startObj < minObj) {
        setError(`⚠️ Date too old. Our weather machine only goes back to ${MIN_API_DATE}.`);
        return;
    }

    // WeatherAPI automatically handles City Names OR Zip Codes in the 'q' parameter
    fetchWeatherAndSave(location, startVal, endVal);
  };

  const fetchWeatherAndSave = async (queryLoc, start, end) => {
    setLoading(true);
    setError(null);
    setCustomForecast([]);

    try {
      const currentResponse = await axios.get(`https://api.weatherapi.com/v1/current.json`, {
        params: { key: WEATHER_API_KEY, q: queryLoc, aqi: 'no' }
      });
      const currentData = currentResponse.data;
      
      localStorage.setItem('last_weather_data', JSON.stringify(currentData));
      setWeather(currentData);
      
      // Update the input field to the "Official" name returned by the API
      setLocation(currentData.location.name);

      const datesToFetch = getDatesInRange(start, end);
      
      const forecastPromises = datesToFetch.map(async (date) => {
        const today = getTodayDate();
        let endpoint = 'forecast.json';
        if (date < today) endpoint = 'history.json';

        try {
           const res = await axios.get(`https://api.weatherapi.com/v1/${endpoint}`, {
             params: { key: WEATHER_API_KEY, q: queryLoc, dt: date }
           });
           
           const dayData = res.data.forecast.forecastday[0];
           const year = parseInt(date.split('-')[0]);
           const isOld = year < MIN_YOUTUBE_YEAR;
           
           return {
             ...dayData,
             youtubeLink: isOld ? null : `https://www.youtube.com/results?search_query=weather+in+${currentData.location.name}+on+${date}`,
             youtubeError: isOld ? "No video links for this era" : null
           };

        } catch (err) {
           console.warn(`Could not fetch data for ${date}`, err);
           return {
             date: date,
             day: { 
               condition: { text: "Unavailable", icon: "//cdn.weatherapi.com/weather/64x64/day/113.png" },
               maxtemp_f: "?",
               mintemp_f: "?"
             }
           };
        }
      });

      const forecastResults = await Promise.all(forecastPromises);
      setCustomForecast(forecastResults);

      const tempString = `${currentData.current.temp_f}°F (${currentData.current.condition.text})`;
      const cleanLocation = `${currentData.location.name}, ${currentData.location.country}`;
      const dateRangeString = `${start} to ${end}`;

      await addRecord(cleanLocation, tempString, dateRangeString);

    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 400) {
        setError("Location not found. Please check spelling or Zip Code.");
      } else {
        setError("Error fetching weather. Please check your internet.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD OPERATIONS ---
  const addRecord = async (loc, temp, range) => {
    const { error } = await supabase
      .from('weather_logs')
      .insert([{ location: loc, temperature: temp, date_range: range, notes: 'Auto-saved' }]);
    if (error) console.error('DB Error:', error);
    else fetchRecords(); 
  };

  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from('weather_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setDbRecords(data);
  };

  const updateRecord = async (id) => {
    const { error } = await supabase.from('weather_logs').update({ notes: editText }).eq('id', id);
    if (!error) { setEditMode(null); fetchRecords(); }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    const { error } = await supabase.from('weather_logs').delete().eq('id', id);
    if (!error) fetchRecords();
  };

  const clearAllRecords = async () => {
    if (dbRecords.length === 0) return;
    if (!window.confirm("⚠️ ARE YOU SURE?")) return;
    const { error } = await supabase.from('weather_logs').delete().neq('id', 0);
    if (!error) fetchRecords();
  };

  const exportJSON = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(dbRecords))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "weather_data.json";
    link.click();
  };

  return (
    <div style={styles.pageBackground}>
      
      {/* --- INFO BUTTON & MODAL --- */}
      <button style={styles.infoBtn} onClick={() => setShowInfoModal(true)}>i</button>
      
      {showInfoModal && (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h2 style={{...styles.cardHeader, fontSize:'1.8rem'}}>Product Manager Accelerator</h2>
                
                <div style={styles.scrollableContent}>
                    <p style={{marginBottom: '15px'}}>
                        The <strong>Product Manager Accelerator Program</strong> is designed to support PM professionals through every stage of their careers. From students looking for entry-level jobs to Directors looking to take on a leadership role, our program has helped over hundreds of students fulfill their career aspirations.
                    </p>
                    <p style={{marginBottom: '15px'}}>
                        Our community is ambitious and committed. Through our program they have learnt, honed and developed new PM and leadership skills, giving them a strong foundation for their future endeavors.
                    </p>

                    <h3 style={{fontSize: '1.2rem', color: '#0D9DE3', textAlign: 'left', marginBottom: '10px'}}>🚀 Our Services:</h3>
                    <ul style={{textAlign: 'left', paddingLeft: '20px', lineHeight: '1.5'}}>
                        <li style={{marginBottom: '10px'}}><strong>PMA Pro:</strong> End-to-end product manager job hunting program that helps you master FAANG-level skills, conduct unlimited mock interviews, and gain job referrals. (Avg offers up to $800K/year!)</li>
                        <li style={{marginBottom: '10px'}}><strong>AI PM Bootcamp:</strong> Gain hands-on AI Product Management skills by building a real-life AI product with a team of Engineers and Data Scientists.</li>
                        <li style={{marginBottom: '10px'}}><strong>PMA Power Skills:</strong> Designed for existing product managers to sharpen leadership and executive presentation skills.</li>
                        <li style={{marginBottom: '10px'}}><strong>PMA Leader:</strong> We help you accelerate your career, get promoted to Director/Executive levels, and win in the board room.</li>
                        <li style={{marginBottom: '10px'}}><strong>1:1 Resume Review:</strong> Rewrite your killer PM resume to stand out, with an interview guarantee.</li>
                    </ul>
                    
                    <p style={{marginTop: '20px', fontSize: '0.9rem', color: '#7F9BA6'}}>
                        <em>Don't forget to check out our free training on the Dr. Nancy Li YouTube channel!</em>
                    </p>
                </div>

                <div style={{display:'flex', gap:'10px', justifyContent:'center', marginTop: '20px'}}>
                    <a href="https://www.linkedin.com/school/pmaccelerator/" target="_blank" rel="noreferrer" style={styles.btnPrimary}>Visit LinkedIn</a>
                    <button style={styles.btnSecondary} onClick={() => setShowInfoModal(false)}>Close</button>
                </div>
            </div>
        </div>
      )}

      <div style={styles.container}>
        <h1 style={styles.header}>Weather Dashboard</h1>
        
        {/* INPUT FORM */}
        <div style={styles.card}>
          <form onSubmit={handleManualSubmit} style={styles.formGrid}>
            
            {/* STANDARD INPUT (No Suggestions) */}
            <div style={{display:'flex', flexDirection:'column'}}>
               <label style={styles.label}>Enter City or Zip Code</label>
               <input 
                 style={styles.input} 
                 placeholder="City name or Zip code..." 
                 value={location} 
                 onChange={(e) => setLocation(e.target.value)}
               />
            </div>
            
            {/* DATE PICKERS */}
            <div style={{display:'flex', flexDirection:'column'}}>
                <label style={styles.label}>Start Date</label>
                <input style={styles.input} type="date" min={MIN_API_DATE} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            
            <div style={{display:'flex', flexDirection:'column'}}>
                <label style={styles.label}>End Date <span style={{color:'#0D9DE3'}}>(Max 7 days)</span></label>
                <input style={styles.input} type="date" min={startDate || MIN_API_DATE} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            
            <div style={styles.btnGroup}>
              <button style={styles.btnPrimary} type="submit">Get Weather</button>
              <button style={styles.btnGeo} type="button" onClick={handleGeolocation}>📍 My Loc</button>
            </div>
          </form>

          {error && <div style={styles.errorBox}>{error}</div>}
        </div>

        {loading && <div style={styles.loadingText}>☀️ Gathering sunshine data...</div>}

        {weather && !loading && (
          <div style={styles.weatherSection}>
            <div style={styles.topRow}>
              <div style={styles.weatherCard}>
                <h2 style={styles.cardHeader}>
                   Current Conditions for <br/> 
                   <span style={{color: '#0D9DE3'}}>{weather.location.name}, {weather.location.country}</span>
                </h2>
                <div style={styles.currentFlex}>
                  <img src={weather.current.condition.icon} alt="icon" style={{width: 80, height: 80}} />
                  <div>
                    <div style={styles.bigTemp}>{weather.current.temp_f}°F</div>
                    <div style={styles.conditionText}>{weather.current.condition.text}</div>
                  </div>
                </div>
                <div style={styles.weatherDetails}>Wind: {weather.current.wind_mph} mph | Humidity: {weather.current.humidity}%</div>
              </div>
              <div style={styles.mapContainer}>
                <iframe
                    width="100%" height="100%" style={{border:0, borderRadius: '15px'}} loading="lazy" allowFullScreen title="Map"
                    src={`https://maps.google.com/maps?q=${weather.location.lat},${weather.location.lon}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                ></iframe>
              </div>
            </div>

            {/* CUSTOM FORECAST WITH YOUTUBE LINKS */}
            {customForecast.length > 0 && (
              <div style={styles.forecastContainer}>
                <h3 style={styles.sectionHeader}>Weather for Selected Range</h3>
                <div style={styles.forecastGrid}>
                  {customForecast.map((day, index) => (
                    <div key={index} style={styles.forecastCard}>
                      <div style={{fontWeight: 'bold', marginBottom: '5px', color: '#0D9DE3'}}>{day.date}</div>
                      {day.day.condition.icon && <img src={day.day.condition.icon} alt="icon" />}
                      <div style={{color: '#333', fontWeight: 'bold', fontSize: '1.2rem', margin: '5px 0'}}>{day.day.maxtemp_f}° / {day.day.mintemp_f}°</div>
                      <div style={{fontSize: '0.9rem', color: '#7F9BA6', marginBottom: '10px'}}>{day.day.condition.text}</div>
                      {day.youtubeLink ? (
                        <a href={day.youtubeLink} target="_blank" rel="noreferrer" style={styles.youtubeLink}>📺 Watch Video</a>
                      ) : (
                         <div style={styles.unavailableLink}>{day.youtubeError}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DATABASE TABLE */}
        <div style={styles.historySection}>
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '15px'}}>
            <h3 style={styles.sectionHeader}>Saved History (DB)</h3>
            <div style={{display: 'flex', gap: '10px'}}>
              <button onClick={exportJSON} style={styles.btnSecondary}>Export JSON</button>
              {dbRecords.length > 0 && <button onClick={clearAllRecords} style={styles.btnClear}>Clear All</button>}
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Range</th>
                  <th style={styles.th}>Temp Logged</th>
                  <th style={styles.th}>Notes</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dbRecords.length === 0 ? (
                  <tr><td colSpan="5" style={{padding: '30px', color: '#888', fontStyle: 'italic'}}>No history yet.</td></tr>
                ) : (
                  dbRecords.map(record => (
                    <tr key={record.id} style={{borderBottom: '1px solid #eee', background: '#fff'}}>
                      <td style={styles.td}>{record.location}</td>
                      <td style={styles.td}>{record.date_range}</td>
                      <td style={styles.td}>{record.temperature}</td>
                      <td style={styles.td}>
                        {editMode === record.id ? <input value={editText} onChange={e => setEditText(e.target.value)} style={styles.inputSmall} /> : record.notes}
                      </td>
                      <td style={styles.td}>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER NAME */}
        <div style={styles.footer}>
            Created by <span style={{color: '#FFD700', textDecoration:'underline'}}>Ashwini Anantharaman</span>
        </div>
      </div>
    </div>
  );
};

// --- STYLES ---
const styles = {
  pageBackground: { 
    minHeight: '100vh', 
    background: 'linear-gradient(180deg, #87CEEB 0%, #01BFFF 100%)', 
    padding: '40px 20px', 
    display: 'flex', 
    justifyContent: 'center',
    boxSizing: 'border-box' 
  },
  
  // Info Button Styles
  infoBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#FFF',
    color: '#0D9DE3',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    border: 'none',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    fontFamily: 'serif'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000
  },
  modalContent: {
    background: '#FFF',
    padding: '30px',
    borderRadius: '20px',
    maxWidth: '550px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    fontFamily: '"Fredoka", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '85vh'
  },
  scrollableContent: {
    textAlign: 'left', 
    lineHeight: '1.5', 
    color: '#555', 
    overflowY: 'auto',
    paddingRight: '10px',
    flex: 1
  },

  container: { width: '100%', maxWidth: '1400px', fontFamily: '"Fredoka", sans-serif', textAlign: 'center', boxSizing: 'border-box'},
  header: { color: '#fff', marginBottom: '30px', fontSize: '3.5rem', fontFamily: '"Chewy", cursive', textShadow: '2px 2px 0px rgba(0,0,0,0.1)' },
  sectionHeader: { color: '#F5F5F5', marginBottom: '0', fontFamily: '"Chewy", cursive', fontSize: '2rem', textShadow: '2px 2px 0px rgba(0,0,0,0.1)'},
  cardHeader: { margin: '0 0 20px 0', fontSize: '2rem', color: '#555', fontFamily: '"Chewy", cursive'},
  card: { background: '#F5F5F5', padding: '30px', borderRadius: '25px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', marginBottom: '20px'},
  formGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '15px', alignItems: 'end' },
  btnGroup: { display: 'flex', gap: '10px' },
  label: { fontSize: '0.9rem', color: '#7F9BA6', fontWeight: 'bold', marginBottom: '4px', textAlign: 'left', fontFamily: '"Fredoka", sans-serif'},
  input: { padding: '12px', borderRadius: '12px', border: '3px solid #E0E0E0', width: '100%', boxSizing: 'border-box', fontSize: '1rem', color: '#333', background: '#FFF', fontFamily: '"Fredoka", sans-serif'},
  inputSmall: { padding: '5px', width: '100%', textAlign: 'center', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ddd' },
  
  errorBox: { marginTop: '20px', padding: '15px', backgroundColor: '#FFF0F0', border: '3px solid #e74c3c', borderRadius: '15px', color: '#c0392b', fontWeight: 'bold', textAlign: 'center', fontFamily: '"Fredoka", sans-serif'},

  btnPrimary: { padding: '12px 25px', background: '#FFD700', color: '#333', border: 'none', borderRadius: '15px', cursor: 'pointer', fontSize: '1.2rem', boxShadow: '0 4px 0px #cfaf00', fontFamily: '"Chewy", cursive', textDecoration:'none'},
  btnGeo: { padding: '12px 25px', background: '#0D9DE3', color: '#fff', border: 'none', borderRadius: '15px', cursor: 'pointer', fontSize: '1.2rem', boxShadow: '0 4px 0px #0b7cb3', fontFamily: '"Chewy", cursive'},
  btnSecondary: { padding: '10px 20px', background: '#7F9BA6', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontFamily: '"Fredoka", sans-serif'},
  btnClear: { padding: '10px 20px', background: '#FF6B6B', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontFamily: '"Fredoka", sans-serif'},
  btnEdit: { marginRight: '8px', cursor: 'pointer', background: 'none', border: 'none', color: '#0D9DE3', textDecoration: 'underline', fontWeight: 'bold' },
  btnSave: { marginRight: '8px', cursor: 'pointer', background: 'none', border: 'none', color: '#27ae60', fontWeight: 'bold' },
  btnDelete: { cursor: 'pointer', background: 'none', border: 'none', color: '#e74c3c', textDecoration: 'underline', fontWeight: 'bold' },
  
  weatherSection: { marginTop: '30px' },
  loadingText: { marginTop: '20px', color: '#fff', fontSize: '1.5rem', fontFamily: '"Chewy", cursive' },
  topRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' },
  weatherCard: { background: '#FFFFFF', padding: '30px', borderRadius: '30px', textAlign: 'center', height: '100%', boxSizing: 'border-box', color: '#333', boxShadow: '0 10px 20px rgba(0,0,0,0.15)', border: '5px solid #FFD700' },
  currentFlex: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '20px' },
  bigTemp: { fontSize: '4.5rem', color: '#333', fontFamily: '"Chewy", cursive', lineHeight: 1},
  conditionText: { color: '#0D9DE3', fontSize: '1.5rem', textTransform: 'uppercase', fontFamily: '"Chewy", cursive'},
  weatherDetails: { marginTop: 15, color: '#7F9BA6', fontWeight: 'bold', fontSize: '1.1rem' },
  mapContainer: { borderRadius: '30px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.15)', background: '#fff' },

  forecastContainer: { marginTop: '20px' },
  forecastGrid: { display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' },
  forecastCard: { width: '160px', background: '#FFFFFF', borderRadius: '20px', padding: '15px', textAlign: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', borderTop: '6px solid #01BFFF' },
  youtubeLink: { display: 'inline-block', marginTop: '10px', padding: '8px 12px', background: '#FF0000', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'},
  unavailableLink: { marginTop: '10px', fontSize: '0.75rem', color: '#999', fontStyle: 'italic'},

  historySection: { marginTop: '50px', paddingTop: '30px', borderTop: '2px dashed rgba(255,255,255,0.5)' },
  tableWrapper: { borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' },
  table: { width: '100%', borderCollapse: 'collapse', margin: '0 auto', tableLayout: 'fixed', background: '#F5F5F5' },
  th: { padding: '15px', background: '#0D9DE3', color: '#fff', textAlign: 'center', fontSize: '1.1rem', fontFamily: '"Chewy", cursive' },
  td: { padding: '15px', color: '#333', textAlign: 'center', borderBottom: '1px solid #E0E0E0', wordWrap: 'break-word', fontFamily: '"Fredoka", sans-serif' },

  footer: { marginTop: '50px', color: '#fff', fontSize: '1.2rem', fontFamily: '"Chewy", cursive' }
};

export default App;