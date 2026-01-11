import { Layout } from '../components/Layout';
import { Camera, Upload, Sparkles, CheckCircle2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ScanPage() {
    const navigate = useNavigate();
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<any>(null);

    const simulateScan = () => {
        setScanning(true);
        setTimeout(() => {
            setScanning(false);
            setResult({
                type: 'Ticket',
                title: 'Flight ZRH -> JFK',
                date: '21 Aug 2024',
                detail: 'Swiss Air LX18'
            });
        }, 2500);
    };

    return (
        <Layout showNav={false}>
            <div className="h-screen relative flex flex-col bg-black">
                {/* Cancel Button */}
                <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-20 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center">
                    <X size={20} />
                </button>

                {/* Camera Viewport Mock */}
                <div className="flex-grow relative overflow-hidden flex items-center justify-center">
                    {!result && (
                        <>
                            <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop)' }}></div>
                            <div className="absolute inset-12 border-2 border-white/50 rounded-3xl z-10 animate-pulse">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl -mb-1 -mr-1"></div>
                            </div>
                            {scanning && (
                                <div className="absolute top-1/2 left-0 right-0 h-1 bg-primary shadow-[0_0_20px_rgba(56,189,248,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                            )}
                        </>
                    )}

                    {result && (
                        <div className="z-20 w-full max-w-xs animate-in zoom-in duration-300">
                            <div className="glass-panel p-6 rounded-2xl border border-primary/30 shadow-glow text-center">
                                <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Item Recognized!</h3>
                                <div className="bg-white/5 p-4 rounded-xl mb-6">
                                    <p className="text-sm text-muted uppercase tracking-wider text-xs mb-1">{result.type}</p>
                                    <p className="text-white font-semibold text-lg">{result.title}</p>
                                    <p className="text-primary text-sm">{result.date} • {result.detail}</p>
                                </div>
                                <button onClick={() => navigate('/')} className="w-full bg-primary text-background font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                                    Add to Itinerary
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                {!result && (
                    <div className="h-48 glass-panel border-t border-white/10 rounded-t-3xl flex flex-col items-center justify-center gap-6 relative z-10 z-20 pb-8">
                        <p className="text-white font-medium text-sm bg-black/40 px-4 py-1 rounded-full">Point at ticket or receipt</p>
                        <div className="flex items-center gap-12 w-full justify-center">
                            <button className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20"><Upload size={24} /></button>
                            <button
                                onClick={simulateScan}
                                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all active:scale-95 ${scanning ? 'border-primary bg-primary/20' : 'border-white bg-white/10'}`}
                            >
                                <div className={`w-16 h-16 rounded-full ${scanning ? 'bg-primary animate-pulse' : 'bg-white'}`}></div>
                            </button>
                            <button className="p-3 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-lg"><Sparkles size={24} /></button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
