import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, query, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Firebase Configuration ---
// SECURE: Reads configuration from environment variables.
// DO NOT PASTE YOUR KEYS HERE. Add them to your Netlify settings.
const firebaseConfig = {
    apiKey: process.env.REACT_APP_API_KEY,
    authDomain: process.env.REACT_APP_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_PROJECT_ID,
    storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_APP_ID
};

// --- App ID ---
const appId = process.env.REACT_APP_CINETRACK_APP_ID || 'default-movie-app';

// --- Configuration Check ---
const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_API_KEY");

// --- Initialize Firebase only if configured ---
let app, db, auth;
if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
}

// --- SVG Icons ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;


// --- Initial Movie Data ---
const initialMovies = [
    { id: '1', title: 'Inception', posterUrl: 'https://placehold.co/400x600/0f172a/ffffff?text=Inception' },
    { id: '2', title: 'The Matrix', posterUrl: 'https://placehold.co/400x600/0f172a/ffffff?text=The+Matrix' },
    { id: '3', title: 'Interstellar', posterUrl: 'https://placehold.co/400x600/0f172a/ffffff?text=Interstellar' },
    { id: '4', title: 'Parasite', posterUrl: 'https://placehold.co/400x600/0f172a/ffffff?text=Parasite' },
    { id: '5', title: 'The Dark Knight', posterUrl: 'https://placehold.co/400x600/0f172a/ffffff?text=The+Dark+Knight' },
    { id: '6', title: 'Stranger Things', posterUrl: 'https://placehold.co/400x600/0f172a/ffffff?text=Stranger+Things' },
];

// --- Helper function to seed initial movie data ---
const seedMovies = async () => {
    if (!auth || !auth.currentUser) return;
    const moviesCollectionRef = collection(db, `/artifacts/${appId}/public/data/movies`);
    try {
        const querySnapshot = await getDocs(moviesCollectionRef);
        if (querySnapshot.empty) {
            console.log("Seeding initial movie data...");
            const seedPromises = initialMovies.map(movie => addDoc(moviesCollectionRef, { title: movie.title, posterUrl: movie.posterUrl }));
            await Promise.all(seedPromises);
        }
    } catch (error) {
        console.error("Error seeding movie data:", error);
    }
};

// --- Configuration Message Component ---
function ConfigurationMessage() {
    return (
        <div className="bg-slate-900 text-white min-h-screen flex items-center justify-center p-8">
            <div className="bg-red-900/50 border border-red-700 p-8 rounded-lg text-center max-w-2xl shadow-2xl">
                <h2 className="text-3xl font-bold mb-4 text-red-400">Configuration Required</h2>
                <p className="text-lg mb-4 text-slate-200">
                    The Firebase API keys are missing or invalid. The application cannot connect to the database.
                </p>
                <p className="text-slate-300">
                    If you are the developer, please ensure you have set up the required environment variables in your hosting provider's settings (e.g., Netlify, Vercel). The variable names must start with <code>REACT_APP_</code> (e.g., <code>REACT_APP_API_KEY</code>).
                </p>
            </div>
        </div>
    );
}


// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('catalog');
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);

    if (!isFirebaseConfigured) {
        return <ConfigurationMessage />;
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthReady(true);
            if (currentUser) {
                setIsAdmin(!currentUser.isAnonymous);
                seedMovies();
            } else {
                setIsAdmin(false);
            }
        });

        const performSignIn = async () => {
            if (!auth.currentUser) {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Error during sign-in:", error);
                }
            }
        };

        performSignIn();
        return () => unsubscribe();
    }, []);

    const showAdmin = () => {
        if (isAdmin) { 
            setView('adminLogin');
        } else {
            console.log("Admin access is restricted.");
        }
    };

    const showCatalog = () => setView('catalog');

    if (!isAuthReady) {
        return (
            <div className="bg-slate-900 text-white min-h-screen flex items-center justify-center">
                <p>Authenticating...</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 text-white min-h-screen font-sans">
            <Header onAdminClick={showAdmin} onCatalogClick={showCatalog} currentView={view} isAdmin={isAdmin} />
            <main className="p-4 md:p-8">
                {view === 'catalog' && <MovieCatalog />}
                {view === 'adminLogin' && <Login onLoginSuccess={() => setView('adminPanel')} />}
                {view === 'adminPanel' && <AdminPanel />}
            </main>
            <Footer />
        </div>
    );
}

// --- Header Component ---
function Header({ onAdminClick, onCatalogClick, currentView, isAdmin }) {
    return (
        <header className="bg-slate-900/70 backdrop-blur-lg sticky top-0 z-40 p-4 flex justify-between items-center border-b border-slate-700">
            <h1 className="text-2xl md:text-3xl font-bold text-red-500 tracking-wider cursor-pointer" onClick={onCatalogClick}>
                CineTrack
            </h1>
            {isAdmin && (
                <button
                    onClick={currentView === 'adminPanel' ? onCatalogClick : onAdminClick}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                >
                    {currentView === 'adminPanel' ? 'View Catalog' : 'Admin Panel'}
                </button>
            )}
        </header>
    );
}

// --- Login Component ---
function Login({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        if (username === 'admin' && password === 'admin') {
            setError('');
            onLoginSuccess();
        } else {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className="flex items-center justify-center">
            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm p-8 rounded-xl shadow-2xl border border-slate-700">
                <h2 className="text-3xl font-bold mb-6 text-center text-gray-200">Admin Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="username">Username</label>
                        <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 bg-slate-700 text-gray-200 leading-tight focus:outline-none focus:shadow-outline border-slate-600" required />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="password">Password</label>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 bg-slate-700 text-gray-200 leading-tight focus:outline-none focus:shadow-outline border-slate-600" required />
                    </div>
                    {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
                    <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- Movie Catalog Component (Public View) ---
function MovieCatalog() {
    const [movies, setMovies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState({ show: false, message: '', isError: false });

    useEffect(() => {
        if (!isFirebaseConfigured) return;
        const moviesCollectionRef = collection(db, `/artifacts/${appId}/public/data/movies`);
        const unsubscribe = onSnapshot(query(moviesCollectionRef), (snapshot) => {
            const moviesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMovies(moviesData);
        });
        return () => unsubscribe();
    }, []);

    const handleRequest = async (movie) => {
        try {
            const visitorId = auth.currentUser?.uid;
            if (!visitorId) throw new Error("User not authenticated.");
            const requestsCollectionRef = collection(db, `/artifacts/${appId}/public/data/requests`);
            await addDoc(requestsCollectionRef, { movieTitle: movie.title, requestedAt: new Date(), actionTaken: false, requestedBy: visitorId });
            setNotification({ show: true, message: `'${movie.title}' requested!`, isError: false });
        } catch (error) {
            console.error("Error adding request: ", error);
            setNotification({ show: true, message: 'Failed to add request.', isError: true });
        }
    };

    const filteredMovies = movies.filter(movie => movie.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div>
            {notification.show && <Notification message={notification.message} isError={notification.isError} onDismiss={() => setNotification({ show: false, message: '', isError: false })} />}
            <h2 className="text-3xl font-bold mb-8 text-center text-gray-200">Movie & Series Catalog</h2>
            <div className="mb-8 max-w-lg mx-auto">
                <div className="relative">
                    <input type="text" placeholder="Search for a movie or series..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 pl-12 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500" />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></div>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {filteredMovies.map(movie => <MovieCard key={movie.id} movie={movie} onRequest={handleRequest} />)}
            </div>
        </div>
    );
}

// --- Movie Card Component ---
function MovieCard({ movie, onRequest }) {
    return (
        <div className="bg-slate-800 rounded-lg overflow-hidden shadow-xl transform hover:-translate-y-2 transition-transform duration-300 ease-in-out group border border-slate-700">
            <img src={movie.posterUrl} alt={`${movie.title} Poster`} className="w-full h-auto object-cover" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/400x600/0f172a/ffffff?text=Not+Found'; }} />
            <div className="p-4 flex flex-col items-center">
                <h3 className="text-lg font-semibold text-center text-white mb-3">{movie.title}</h3>
                <button onClick={() => onRequest(movie)} className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out hover:bg-red-700">
                    Request
                </button>
            </div>
        </div>
    );
}

// --- Admin Panel Component ---
function AdminPanel() {
    const [activeTab, setActiveTab] = useState('requests'); // 'requests', 'catalog'
    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex justify-center border-b border-slate-700">
                <button onClick={() => setActiveTab('requests')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'requests' ? 'text-red-500 border-b-2 border-red-500' : 'text-slate-400'}`}>Visitor Requests</button>
                <button onClick={() => setActiveTab('catalog')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'catalog' ? 'text-red-500 border-b-2 border-red-500' : 'text-slate-400'}`}>Manage Catalog</button>
            </div>
            {activeTab === 'requests' && <RequestPanel />}
            {activeTab === 'catalog' && <ManageCatalogPanel />}
        </div>
    );
}

// --- Manage Catalog Panel ---
function ManageCatalogPanel() {
    const [movies, setMovies] = useState([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [movieToEdit, setMovieToEdit] = useState(null);
    const [movieToDelete, setMovieToDelete] = useState(null);

    useEffect(() => {
        if (!isFirebaseConfigured) return;
        const moviesCollectionRef = collection(db, `/artifacts/${appId}/public/data/movies`);
        const unsubscribe = onSnapshot(query(moviesCollectionRef), (snapshot) => {
            const moviesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMovies(moviesData);
        });
        return () => unsubscribe();
    }, []);

    const handleDeleteClick = (movie) => {
        setMovieToDelete(movie);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (movieToDelete) {
            const movieDocRef = doc(db, `/artifacts/${appId}/public/data/movies`, movieToDelete.id);
            await deleteDoc(movieDocRef);
            setMovieToDelete(null);
            setShowDeleteModal(false);
        }
    };

    const handleEditClick = (movie) => {
        setMovieToEdit(movie);
        setShowEditModal(true);
    };

    const handleSaveEdit = async (updatedMovie) => {
        if (movieToEdit) {
            const movieDocRef = doc(db, `/artifacts/${appId}/public/data/movies`, movieToEdit.id);
            await updateDoc(movieDocRef, {
                title: updatedMovie.title,
                posterUrl: updatedMovie.posterUrl
            });
            setShowEditModal(false);
            setMovieToEdit(null);
        }
    };

    return (
        <div className="space-y-8">
            <AddMovieForm />
            <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-slate-700">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-200">Current Catalog</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {movies.map(movie => (
                        <div key={movie.id} className="relative group">
                            <img src={movie.posterUrl} alt={movie.title} className="rounded-lg" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(movie)} className="bg-blue-600 p-3 rounded-full text-white"><EditIcon /></button>
                                <button onClick={() => handleDeleteClick(movie)} className="bg-red-600 p-3 rounded-full text-white"><TrashIcon /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {showDeleteModal && <ConfirmationModal message={`Delete "${movieToDelete?.title}" from the catalog?`} onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} />}
            {showEditModal && <EditMovieModal movie={movieToEdit} onSave={handleSaveEdit} onCancel={() => setShowEditModal(false)} />}
        </div>
    );
}

// --- Edit Movie Modal Component ---
function EditMovieModal({ movie, onSave, onCancel }) {
    const [title, setTitle] = useState(movie.title);
    const [posterUrl, setPosterUrl] = useState(movie.posterUrl);

    const handleSave = () => {
        onSave({ title, posterUrl });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-700 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Edit Movie</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500" />
                    <input type="text" placeholder="Poster Image URL" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} className="w-full p-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onCancel} className="py-2 px-4 rounded bg-slate-600 hover:bg-slate-500">Cancel</button>
                    <button onClick={handleSave} className="py-2 px-4 rounded bg-blue-600 hover:bg-blue-500">Save Changes</button>
                </div>
            </div>
        </div>
    );
}


// --- Add Movie Form Component ---
function AddMovieForm() {
    const [title, setTitle] = useState('');
    const [posterUrl, setPosterUrl] = useState('');
    const [notification, setNotification] = useState({ show: false, message: '', isError: false });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFirebaseConfigured) return;
        if (!title.trim() || !posterUrl.trim()) {
            setNotification({ show: true, message: 'Please fill out both fields.', isError: true });
            return;
        }
        try {
            const moviesCollectionRef = collection(db, `/artifacts/${appId}/public/data/movies`);
            await addDoc(moviesCollectionRef, { title, posterUrl });
            setNotification({ show: true, message: `'${title}' added successfully!`, isError: false });
            setTitle('');
            setPosterUrl('');
        } catch (error) {
            setNotification({ show: true, message: 'Failed to add movie.', isError: true });
        }
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-slate-700">
            {notification.show && <Notification message={notification.message} isError={notification.isError} onDismiss={() => setNotification({ show: false, message: '', isError: false })} />}
            <h2 className="text-2xl font-bold mb-4 text-center text-gray-200">Add New Movie/Series</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500" />
                <input type="text" placeholder="Poster Image URL" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} className="w-full p-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500" />
                <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"><PlusIcon /> Add to Catalog</button>
            </form>
        </div>
    );
}

// --- Request Panel Component ---
function RequestPanel() {
    const [groupedRequests, setGroupedRequests] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [requestGroupToDelete, setRequestGroupToDelete] = useState(null);

    useEffect(() => {
        if (!isFirebaseConfigured) return;
        const requestsCollectionRef = collection(db, `/artifacts/${appId}/public/data/requests`);
        const unsubscribe = onSnapshot(query(requestsCollectionRef), (snapshot) => {
            const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const groups = requestsData.reduce((acc, request) => {
                const title = request.movieTitle;
                if (!acc[title]) {
                    acc[title] = {
                        movieTitle: title,
                        ids: [],
                        requesters: [],
                        latestDate: new Date(0),
                        allActioned: true,
                    };
                }
                
                acc[title].ids.push(request.id);
                acc[title].requesters.push(request.requestedBy);
                if (request.requestedAt.toDate() > acc[title].latestDate) {
                    acc[title].latestDate = request.requestedAt.toDate();
                }
                if (!request.actionTaken) {
                    acc[title].allActioned = false;
                }
                
                return acc;
            }, {});

            let processedRequests = Object.values(groups);

            processedRequests.sort((a, b) => {
                if (a.allActioned === b.allActioned) {
                    return b.latestDate - a.latestDate;
                }
                return a.allActioned ? 1 : -1;
            });
            
            setGroupedRequests(processedRequests);
        });
        return () => unsubscribe();
    }, []);

    const handleActionToggle = async (requestGroup) => {
        const batch = writeBatch(db);
        const newActionState = !requestGroup.allActioned;
        requestGroup.ids.forEach(id => {
            const requestDocRef = doc(db, `/artifacts/${appId}/public/data/requests`, id);
            batch.update(requestDocRef, { actionTaken: newActionState });
        });
        await batch.commit();
    };

    const handleDeleteClick = (requestGroup) => {
        setRequestGroupToDelete(requestGroup);
        setShowModal(true);
    };

    const confirmDelete = async () => {
        if (requestGroupToDelete) {
            const batch = writeBatch(db);
            requestGroupToDelete.ids.forEach(id => {
                const requestDocRef = doc(db, `/artifacts/${appId}/public/data/requests`, id);
                batch.delete(requestDocRef);
            });
            await batch.commit();
            setRequestGroupToDelete(null);
            setShowModal(false);
        }
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-slate-700">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-200">Visitor Request Panel</h2>
            {groupedRequests.length === 0 ? <p className="text-center text-slate-400">No requests from visitors yet.</p> : (
                <ul className="space-y-4">
                    {groupedRequests.map(group => (
                        <li key={group.movieTitle} className={`flex items-center justify-between p-4 rounded-lg transition-colors duration-300 ${group.allActioned ? 'bg-slate-800 text-slate-500' : 'bg-slate-900'}`}>
                            <div>
                                <div className="flex items-center gap-3">
                                    <p className={`font-bold text-lg ${group.allActioned ? 'line-through' : ''}`}>{group.movieTitle}</p>
                                    <span className="text-xs font-bold bg-red-500 text-white px-2 py-1 rounded-full">{group.ids.length}</span>
                                </div>
                                <p className="text-sm text-slate-400">Last requested: {group.latestDate.toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleActionToggle(group)} className={`py-2 px-4 rounded-lg font-semibold transition-transform duration-200 transform hover:scale-105 ${group.allActioned ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-green-500 hover:bg-green-600 text-white'}`}>
                                    {group.allActioned ? 'Undo' : 'Done'}
                                </button>
                                <button onClick={() => handleDeleteClick(group)} className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"><TrashIcon /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {showModal && <ConfirmationModal message={`Delete all ${requestGroupToDelete?.ids.length} requests for "${requestGroupToDelete?.movieTitle}"?`} onConfirm={confirmDelete} onCancel={() => setShowModal(false)} />}
        </div>
    );
}

// --- Confirmation Modal Component ---
function ConfirmationModal({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-700">
                <p className="text-lg mb-4">{message}</p>
                <div className="flex justify-end gap-4">
                    <button onClick={onCancel} className="py-2 px-4 rounded bg-slate-600 hover:bg-slate-500">Cancel</button>
                    <button onClick={onConfirm} className="py-2 px-4 rounded bg-red-600 hover:bg-red-500">Confirm</button>
                </div>
            </div>
        </div>
    );
}

// --- Notification Component ---
function Notification({ message, isError, onDismiss }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const bgColor = isError ? 'bg-red-500' : 'bg-green-500';
    return (
        <div className={`fixed top-5 right-5 ${bgColor} text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50`}>
            {message}
        </div>
    );
}

// --- Footer Component ---
function Footer() {
    return <footer className="text-center p-4 mt-8 text-slate-500 text-sm"><p>Powered by CineTrack</p></footer>;
}

// --- Add CSS for animations ---
const style = document.createElement('style');
style.textContent = `
    @keyframes fade-in-out {
        0% { opacity: 0; transform: translateY(-20px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
    }
    .animate-fade-in-out { animation: fade-in-out 3s ease-in-out forwards; }
`;
document.head.append(style);
