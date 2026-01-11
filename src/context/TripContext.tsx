import React, { createContext, useContext, useState, useMemo } from 'react';
import { TimelineEvent } from '../components/TimelineItem';

// Initial Mock Data (Moved from ItineraryPage)
const MOCK_EVENTS_DATA: TimelineEvent[] = [
    {
        id: '1',
        type: 'Transport',
        title: 'Arrive at Zurich International Airport',
        time: '03:00 PM',
        description: 'Terminal 1, Flight LX180',
        dayOffset: 0,
        duration: '45m'
    },
    {
        id: '2',
        type: 'Eat',
        title: 'Elfrentes Roasting',
        time: '04:00 PM',
        endTime: '11:00 PM',
        status: 'Open now',
        rating: 4.7,
        reviews: 2735,
        description: 'Specialty coffee roaster with light bites.',
        dayOffset: 0,
        travelTime: '30m',
        travelMode: 'drive',
        duration: '1h 30m'
    },
    {
        id: '3',
        type: 'Play',
        title: 'Spend the day exploring Zurich',
        time: '05:00 PM',
        description: 'Old Town, Lake Zurich, and Bahnhofstrasse.',
        dayOffset: 0,
        travelTime: '15m',
        travelMode: 'walk',
        duration: '3h'
    },
    {
        id: '4',
        type: 'Eat',
        title: 'Elmira fine dining',
        time: '07:00 PM',
        rating: 4.9,
        reviews: 854,
        description: 'Modern Swiss cuisine.',
        dayOffset: 0,
        travelTime: '20m',
        travelMode: 'transit',
        duration: '2h'
    },
    {
        id: '5',
        type: 'Stay',
        title: 'BVLGARI Hotel',
        time: '07:45 PM',
        description: 'Check-in confirmed.',
        dayOffset: 0,
        travelTime: '10m',
        travelMode: 'drive'
    },
    {
        id: '6',
        type: 'Eat',
        title: 'Cafe Odeon',
        time: '09:00 AM',
        description: 'Historic Art Nouveau café.',
        dayOffset: 1,
        duration: '1h'
    },
    {
        id: '7',
        type: 'Play',
        title: 'Kunsthaus Zürich',
        time: '11:00 AM',
        description: 'Visit the art museum.',
        dayOffset: 1,
        duration: '2h 15m'
    }
];

interface TripSettings {
    tripName: string;
    startDate: Date;
    tripDuration: number;
}

interface TripContextType {
    // Trip Settings
    tripName: string;
    setTripName: (name: string) => void;
    startDate: Date;
    setStartDate: (date: Date) => void;
    tripDuration: number;
    setTripDuration: (days: number) => void;
    placesCoverImage: string;
    setPlacesCoverImage: (url: string) => void;

    // Events
    events: TimelineEvent[];
    setEvents: (events: TimelineEvent[] | ((prev: TimelineEvent[]) => TimelineEvent[])) => void;

    // Computed
    tripDates: { dateObj: Date; dayName: string; dateNum: number; fullDate: string; offset: number }[];
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
    const [tripName, setTripName] = useState('Bali Trip');
    const [startDate, setStartDate] = useState(new Date('2024-08-21'));
    const [tripDuration, setTripDuration] = useState(9);
    const [placesCoverImage, setPlacesCoverImage] = useState('https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=1000&q=80');
    const [events, setEvents] = useState<TimelineEvent[]>(MOCK_EVENTS_DATA);

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const tripDates = useMemo(() => {
        return Array.from({ length: tripDuration }, (_, i) => {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            return {
                dateObj: d,
                dayName: DAYS[d.getDay()],
                dateNum: d.getDate(),
                fullDate: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`,
                offset: i
            };
        });
    }, [startDate, tripDuration]);

    return (
        <TripContext.Provider value={{
            tripName, setTripName,
            startDate, setStartDate,
            tripDuration, setTripDuration,
            placesCoverImage, setPlacesCoverImage,
            events, setEvents,
            tripDates
        }}>
            {children}
        </TripContext.Provider>
    );
}

export function useTrip() {
    const context = useContext(TripContext);
    if (context === undefined) {
        throw new Error('useTrip must be used within a TripProvider');
    }
    return context;
}
