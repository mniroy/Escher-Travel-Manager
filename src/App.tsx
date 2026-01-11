import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TripProvider } from './context/TripContext';
import ItineraryPage from './pages/ItineraryPage';
import PlaceDetailPage from './pages/PlaceDetailPage';
import MapPage from './pages/MapPage';
import PlacesPage from './pages/PlacesPage';
import DocumentsPage from './pages/DocumentsPage';

function App() {
    return (
        <TripProvider>
            <Router>
                <div className="min-h-screen bg-background text-text selection:bg-primary selection:text-background font-sans">
                    <Routes>
                        <Route path="/" element={<ItineraryPage />} />
                        <Route path="/place/:id" element={<PlaceDetailPage />} />
                        <Route path="/map" element={<MapPage />} />
                        <Route path="/places" element={<PlacesPage />} />
                        <Route path="/documents" element={<DocumentsPage />} />
                        <Route path="*" element={<ItineraryPage />} />
                    </Routes>
                </div>
            </Router>
        </TripProvider>
    );
}

export default App;
