import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TripProvider, useTrip } from './context/TripContext';
import ItineraryPage from './pages/ItineraryPage';
import PlaceDetailPage from './pages/PlaceDetailPage';
import MapPage from './pages/MapPage';
import PlacesPage from './pages/PlacesPage';
import ExplorePlacesPage from './pages/ExplorePlacesPage';
import DocumentsPage from './pages/DocumentsPage';
import { ScrollToTop } from './components/ScrollToTop';
import TripSummaryPage from './pages/TripSummaryPage';

function AppContent() {
    const { isLoading } = useTrip();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-400 text-sm font-medium">Loading your trips...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-text selection:bg-primary selection:text-background font-sans">
            <Routes>
                <Route path="/summary" element={<TripSummaryPage />} />
                <Route path="/" element={<ItineraryPage />} />
                <Route path="/place/:id" element={<PlaceDetailPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/places" element={<PlacesPage />} />
                <Route path="/places/explore" element={<ExplorePlacesPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="*" element={<ItineraryPage />} />
            </Routes>
        </div>
    );
}

function App() {
    return (
        <TripProvider>
            <Router>
                <ScrollToTop />
                <AppContent />
            </Router>
        </TripProvider>
    );
}

export default App;

