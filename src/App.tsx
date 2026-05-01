import { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Home, 
  LogOut, 
  Plus, 
  Play,
  Search,
  Bell,
  Download,
  Star as PremiumIcon,
  Filter,
  ChevronRight,
  Twitter,
  Facebook,
  Bookmark,
  ThumbsUp,
  History,
  Users,
  FileText,
  MessageSquare,
  Settings,
  Upload,
  X,
  Crown
} from 'lucide-react';
import { auth, db, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Firebase Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---
interface VideoData {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  uploaderId: string;
  uploaderName: string;
  uploaderPhoto: string;
  views: number;
  language?: string;
  ranking?: number;
  type?: 'video' | 'short';
  createdAt: unknown;
}

interface NotificationData {
  id: string;
  title: string;
  message: string;
  createdAt: any; // using any for Timestamp compatibility here to keep it simple, or `unknown` but cast properly.
}

// --- Components ---

const AdminUploadView = ({ user, onBack, onComplete }: { user: User, onBack: () => void, onComplete: () => void }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [url, setUrl] = useState('');
  const [videoType, setVideoType] = useState('video');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Video
      await addDoc(collection(db, 'videos'), {
        title,
        description,
        thumbnail,
        url,
        type: videoType,
        uploaderId: user.uid,
        uploaderName: user.displayName || 'Admin',
        uploaderPhoto: user.photoURL,
        views: 0,
        createdAt: serverTimestamp()
      });
      
      // 2. Create Notification
      await addDoc(collection(db, 'notifications'), {
        title: videoType === 'short' ? 'New Short Uploaded!' : 'New Video Uploaded!',
        message: `${user.displayName || 'Admin'} just uploaded: ${title}`,
        createdAt: serverTimestamp()
      });
      
      onComplete();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-6 py-10"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
          <Upload className="w-6 h-6 text-green-500" /> Admin Panel
        </h2>
        <button onClick={onBack} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Video Title</label>
          <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors" placeholder="Enter title" />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Content Type</label>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => setVideoType('video')} className={cn("py-3 rounded-xl font-bold text-sm uppercase tracking-widest border transition-all", videoType === 'video' ? "bg-green-500/20 text-green-500 border-green-500" : "bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300")}>
              Standard Video
            </button>
            <button type="button" onClick={() => setVideoType('short')} className={cn("py-3 rounded-xl font-bold text-sm uppercase tracking-widest border transition-all", videoType === 'short' ? "bg-green-500/20 text-green-500 border-green-500" : "bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300")}>
              Short Video
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Description</label>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors h-24" placeholder="Enter description" />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Thumbnail URL</label>
          <input required type="url" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors" placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Video URL</label>
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors" placeholder="https://..." />
        </div>

        <button disabled={loading} type="submit" className="w-full bg-green-500 text-zinc-950 font-black py-4 rounded-xl mt-6 hover:bg-green-400 transition-colors disabled:opacity-50">
          {loading ? 'UPLOADING...' : 'PUBLISH VIDEO'}
        </button>
      </form>
    </motion.div>
  );
};

const TopNav = ({ searchQuery, setSearchQuery, notifications, showNotifications, setShowNotifications }: { 
  searchQuery: string, 
  setSearchQuery: (q: string) => void, 
  notifications: NotificationData[],
  showNotifications: boolean,
  setShowNotifications: (v: boolean) => void
}) => (
  <nav className="fixed top-0 left-0 right-0 h-14 glass z-50 flex items-center justify-between px-4 sm:px-6">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-7 h-7 text-green-500 fill-current">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
      </div>
      <div className="relative flex-1 max-w-[200px] sm:max-w-md">
        <div className="bg-zinc-800/50 border border-white/10 rounded-lg flex items-center px-3 py-1.5 focus-within:ring-1 ring-green-500/50 transition-all">
          <Search className="w-4 h-4 text-zinc-400 mr-2" />
          <input 
            type="text" 
            placeholder="Smallville" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none"
          />
          <button className="text-green-500 text-sm font-bold ml-2 hover:opacity-80 transition-opacity">Search</button>
        </div>
      </div>
    </div>
    
    <div className="flex items-center gap-3 relative">
       <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 hover:bg-white/5 rounded-lg transition-colors relative">
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
      </button>

      <AnimatePresence>
        {showNotifications && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-12 right-0 w-80 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden shadow-black/80 z-50"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-tight">Notifications</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm font-bold tracking-widest uppercase">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="p-4 border-b border-white/5 bg-zinc-800/20 hover:bg-zinc-800/50 transition-colors">
                    <p className="font-bold text-sm text-zinc-200">{n.title}</p>
                    <p className="text-xs text-zinc-400 mt-1">{n.message}</p>
                    <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-bold">{auth.currentUser ? 'Me' : '?'}</div>
    </div>
  </nav>
);

const CategoryScroll = ({ categories, active, onSelect }: { categories: string[], active: string, onSelect: (c: string) => void }) => (
  <div className="flex overflow-x-auto hide-scrollbar gap-6 px-6 py-3 border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm sticky top-14 z-40">
    {categories.map(cat => (
      <button 
        key={cat}
        onClick={() => onSelect(cat)}
        className={cn(
          "text-sm font-bold whitespace-nowrap transition-all relative px-1",
          active === cat ? "text-white" : "text-zinc-500 hover:text-zinc-300"
        )}
      >
        {cat}
        {active === cat && (
          <motion.div layoutId="cat-active" className="absolute -bottom-[1px] left-0 right-0 h-1 bg-red-500 rounded-full" />
        )}
      </button>
    ))}
  </div>
);

const MovieCard = ({ video, onClick }: { video: VideoData, onClick?: () => void }) => {
  const shareToTwitter = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Watching ' + video.title + ' on VStream!')}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400');
  };

  const shareToFacebook = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      onClick={onClick}
      className="relative group flex-shrink-0 w-[140px] sm:w-[180px] space-y-2 cursor-pointer"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.03] group-hover:-translate-y-2">
        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold border border-white/10 uppercase tracking-tighter">
          {video.language || 'Hindi'}
        </div>

        {/* Share Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300">
          <button 
            onClick={shareToTwitter}
            className="p-1.5 bg-black/60 backdrop-blur-md rounded-full text-zinc-300 hover:text-[#1DA1F2] hover:bg-white/10 transition-all border border-white/10"
            title="Share on Twitter"
          >
            <Twitter className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={shareToFacebook}
            className="p-1.5 bg-black/60 backdrop-blur-md rounded-full text-zinc-300 hover:text-[#1877F2] hover:bg-white/10 transition-all border border-white/10"
            title="Share on Facebook"
          >
            <Facebook className="w-3.5 h-3.5" />
          </button>
        </div>

        {video.ranking && (
          <div className="absolute bottom-0 left-0 p-2 flex items-end">
            <span className="text-5xl font-black text-red-600 drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] tracking-tighter-minus -ml-1 italic">{video.ranking}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
      <div className="px-1">
        <h3 className="font-bold text-sm text-zinc-100 line-clamp-1 group-hover:text-green-400 transition-colors">{video.title}</h3>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{video.language || 'Hindi'}</p>
      </div>
    </motion.div>
  );
};

const Section = ({ title, videos, ranking = false, onVideoSelect }: { title: string, videos: VideoData[], ranking?: boolean, onVideoSelect?: (v: VideoData) => void }) => (
  <section className="mb-10 pl-6 pr-0">
    <div className="flex items-center justify-between mb-4 pr-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        {title === 'Cinema' && <span className="p-1 px-1.5 rounded bg-red-600 text-[10px] animate-pulse">LIVE</span>}
        {title}
      </h2>
      <button className="text-xs text-zinc-500 font-bold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest">
        All <ChevronRight className="w-3 h-3" />
      </button>
    </div>
    <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4">
      {videos.map((v, i) => <MovieCard key={v.id} video={{...v, ranking: ranking ? i + 1 : undefined}} onClick={() => onVideoSelect?.(v)} />)}
    </div>
  </section>
);

const VideoPlayerView = ({ video, onClose }: { video: VideoData, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: '100%' }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: '100%' }}
    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
  >
    {/* Main Video Container */}
    <div className="relative w-full aspect-video bg-black flex-shrink-0">
      {/* Close Button */}
      <button onClick={onClose} className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/50 backdrop-blur-md flex items-center justify-center rounded-full hover:bg-white/20 transition-all border border-white/10">
        <ChevronRight className="w-6 h-6 rotate-180" />
      </button>
      {/* Mock Video Player */}
      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
          <Play className="w-8 h-8 fill-white text-white ml-1" />
        </div>
      </div>
      {/* Progress bar mock */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div className="h-full bg-red-600 w-1/3 relative">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full shadow" />
        </div>
      </div>
    </div>
    
    {/* Video Metadata & Actions Container */}
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Title & Basic Stats */}
      <div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter">{video.title}</h1>
        <p className="text-sm font-bold text-zinc-400 mt-2 flex items-center gap-2">
          {video.views.toLocaleString()} Views • {video.language || 'Hindi'}
        </p>
      </div>

      {/* Quick Actions (My List, Download) */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button className="flex-1 bg-white/10 hover:bg-white/20 transition-all py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest border border-white/5">
          <Plus className="w-4 h-4" /> My List
        </button>
        <button className="flex-1 bg-white/10 hover:bg-white/20 transition-all py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest border border-white/5">
          <Download className="w-4 h-4" /> Download
        </button>
      </div>

      {/* Video Description */}
      <p className="text-zinc-300 text-sm leading-relaxed">{video.description}</p>
      
      {/* Uploader Profile & Follow Action */}
      <div className="pt-4 flex items-center gap-4">
        <img src={video.uploaderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.uploaderName}`} alt={video.uploaderName} className="w-12 h-12 rounded-full border border-white/10" />
        <div className="flex-1">
          <p className="font-bold text-white uppercase tracking-tight">{video.uploaderName}</p>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Creator</p>
        </div>
        <button className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition-all">
          Follow
        </button>
      </div>
    </div>
  </motion.div>
);

const BottomNav = ({ active, onChange }: { active: string, onChange: (v: string) => void }) => (
  <nav className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-white/10 flex items-center justify-around px-4 z-50">
    {[
      { id: 'home', icon: Home, label: 'Home' },
      { id: 'premium', icon: PremiumIcon, label: 'Premium' },
      { id: 'downloads', icon: Download, label: 'Downloads' },
      { id: 'me', icon: UserIcon, label: 'Me' },
    ].map(item => (
      <button 
        key={item.id}
        onClick={() => onChange(item.id)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 w-16 transition-all",
          active === item.id ? "text-green-500" : "text-zinc-500 hover:text-zinc-300"
        )}
      >
        <item.icon className={cn("w-6 h-6", active === item.id && "animate-bounce-in")} />
        <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
      </button>
    ))}
  </nav>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'home' | 'me' | 'downloads' | 'premium'>('home');
  const [currentCategory, setCurrentCategory] = useState('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [playingVideo, setPlayingVideo] = useState<VideoData | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // Fetch Notifications
    const fetchNotifications = async () => {
      try {
        const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationData)));
      } catch (err) {
        console.error("Error fetching notifications", err);
      }
    };
    fetchNotifications();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await setDoc(doc(db, 'users', u.uid), {
            displayName: u.displayName || 'User',
            email: u.email || '',
            photoURL: u.photoURL || '',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
        }
      }
      fetchGlobalVideos();
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchGlobalVideos = async () => {
    const path = 'videos';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoData));
      
      // If no videos, provide mock data for that "Real Streaming" feel
      if (data.length === 0) {
        setVideos([
          { id: '1', title: 'Matka King', language: 'Hindi', thumbnail: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=2070&auto=format&fit=crop', ranking: 1 } as unknown as VideoData,
          { id: '2', title: 'The Boys', language: 'Hindi', thumbnail: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop', ranking: 2 } as unknown as VideoData,
          { id: '3', title: 'Bhooth Bangla', language: 'Hindi', thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop', ranking: 3 } as unknown as VideoData,
          { id: '4', title: 'Bloodhounds', language: 'Hindi', thumbnail: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=2070&auto=format&fit=crop', ranking: 4 } as unknown as VideoData,
        ]);
      } else {
        setVideos(data);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950">
        <div className="w-10 h-10 border-2 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-zinc-500 font-black uppercase tracking-tighter text-[10px] transition-pulse">Loading Cinematic Experience</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <TopNav 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
      />
      
      <main className="pt-14">
        {currentTab === 'home' && (
          <div className="animate-fade-in">
            {searchQuery ? (
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold uppercase tracking-tighter mb-6 flex items-center gap-2">
                  <Search className="w-5 h-5 text-green-500" /> 
                  Search Results for "{searchQuery}"
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.description?.toLowerCase().includes(searchQuery.toLowerCase())).map(v => (
                    <MovieCard key={v.id} video={v} onClick={() => setPlayingVideo(v)} />
                  ))}
                  {videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.description?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="col-span-full py-12 text-center text-zinc-500 font-bold uppercase tracking-widest text-sm bg-zinc-900/50 rounded-2xl border border-white/5">
                      No results found
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <CategoryScroll 
                  categories={['Trending', 'Movie', 'TV', 'Anime', 'ShortTV', 'Kids', 'Sports']} 
                  active={currentCategory}
                  onSelect={setCurrentCategory}
                />

                {/* Hero Section */}
                <section className="relative w-full h-[450px] sm:h-[550px] overflow-hidden">
                   <img 
                    src="https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=2231&auto=format&fit=crop" 
                    className="w-full h-full object-cover transform scale-105" 
                    alt="Featured"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />
                  
                  <div className="absolute bottom-10 left-6 sm:left-10 max-w-lg space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1 px-1.5 bg-red-600 rounded text-[10px] font-black italic">HOT</div>
                      <span className="text-zinc-300 font-bold text-sm tracking-tight">VStream Exclusive</span>
                    </div>
                    <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter leading-none drop-shadow-2xl">BLOODHOUNDS</h1>
                    <p className="text-zinc-400 text-sm font-bold line-clamp-2 max-w-sm">Two young boxers team up with a benevolent moneylender to take down a ruthless loan shark who preys on the financially desperate.</p>
                    <div className="flex items-center gap-4 pt-2">
                       <button className="flex items-center gap-3 bg-zinc-100 text-zinc-950 px-8 py-3 rounded-xl font-black hover:bg-white transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-green-500/10">
                        <Play className="w-5 h-5 fill-current" />
                        PLAY NOW
                      </button>
                      <button className="p-3 bg-zinc-800/40 backdrop-blur-md rounded-xl hover:bg-zinc-700/50 transition-all border border-white/5">
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Categories and Content */}
                <div className="py-8 space-y-2">
                  <div className="px-6 mb-6">
                     <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black uppercase tracking-tighter">Categories</h2>
                        <Filter className="w-5 h-5 text-zinc-500 cursor-pointer" />
                     </div>
                     <div className="flex gap-3 mt-4 overflow-x-auto hide-scrollbar">
                        {['All', 'Bollywood', 'Hollywood', 'South Indian', 'Korean'].map(tag => (
                          <div key={tag} className="flex-shrink-0 relative group cursor-pointer">
                            <div className="w-32 h-16 rounded-xl overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
                              <img src={`https://images.unsplash.com/photo-${tag === 'Bollywood' ? '1585951237318-9ea5e175b891' : '1509281373149-e957c6296406'}?auto=format&fit=crop&q=40&w=200`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 group-hover:bg-green-500/20 transition-all flex items-center justify-center">
                                <span className="text-xs font-black uppercase tracking-widest">{tag}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                     </div>
                  </div>

                  <Section title="Rankings" videos={videos.filter(v => !currentCategory || currentCategory === 'All' || v.type === currentCategory)} ranking onVideoSelect={setPlayingVideo} />
                  <Section title="Cinema" videos={videos.filter(v => !currentCategory || currentCategory === 'All' || v.type === currentCategory)} onVideoSelect={setPlayingVideo} />
                  <Section title="Recommended for You" videos={videos.filter(v => !currentCategory || currentCategory === 'All' || v.type === currentCategory).slice().reverse()} onVideoSelect={setPlayingVideo} />
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === 'me' && (
          isAdminView ? (
            user && <AdminUploadView user={user} onBack={() => setIsAdminView(false)} onComplete={() => { setIsAdminView(false); fetchGlobalVideos(); }} />
          ) : (
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-6 pb-20"
           >
             <div className="flex items-center gap-6 mb-6">
                <div className="relative group">
                  <img src={user?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'} alt="" className="w-20 h-20 rounded-full border border-white/20 p-0.5 object-cover" />
                </div>
                <div>
                  <h2 className="text-xl font-bold uppercase">{user?.displayName || 'Guest User'}</h2>
                  <p className="text-zinc-400 text-xs mt-1">ID: {user?.uid.slice(0, 8) || '00000000'}</p>
                  {!user && (
                    <button onClick={signInWithGoogle} className="mt-2 bg-green-500 text-zinc-950 px-4 py-1.5 rounded-lg font-bold text-xs hover:bg-green-400 transition-all">SIGN IN</button>
                  )}
                </div>
             </div>

             <div className="bg-zinc-800/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between mb-2">
               <div>
                 <h3 className="flex items-center gap-2 font-bold text-sm text-zinc-200">
                    <Crown className="w-4 h-4 text-yellow-500" /> Premium Trial
                 </h3>
                 <p className="text-xs text-zinc-500 mt-1">24 days left</p>
               </div>
               <button className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-yellow-500/50">
                 <Star className="w-3 h-3 fill-current" /> 70
               </button>
             </div>

             <div className="space-y-1 mt-4">
                <MenuAction icon={Star} label="Rewards Center" onClick={() => {}} />
             </div>

             <div className="space-y-1 mt-4">
                <MenuAction icon={Bookmark} label="My List" count="0" onClick={() => {}} />
                <MenuAction icon={ThumbsUp} label="My Likes" count="0" onClick={() => {}} />
             </div>

             <div className="mt-4">
                <div className="flex items-center justify-between px-2 mb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-zinc-200"><History className="w-4 h-4" /> Watch History</h3>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar px-2 pb-2">
                  {videos.slice(0, 4).map(v => (
                    <div key={v.id} className="relative w-32 shrink-0 aspect-[16/9] rounded-lg overflow-hidden group">
                      <img src={v.thumbnail} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors" />
                      <div className="absolute inset-x-0 bottom-0 py-1 px-2 bg-gradient-to-t from-black to-transparent">
                        <p className="text-[10px] font-bold text-white truncate">{v.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
             </div>

             <div className="space-y-1 mt-4">
                <MenuAction icon={Bell} label="Messages" onClick={() => {}} />
             </div>

             <div className="space-y-1 mt-4">
                <MenuAction icon={Users} label="Community" count="0" onClick={() => {}} />
                <MenuAction icon={FileText} label="Posts" count="0" onClick={() => {}} />
                <MenuAction icon={MessageSquare} label="My Comments" count="0" onClick={() => {}} />
             </div>

             <div className="space-y-1 mt-4">
                {user && <MenuAction icon={Upload} label="Admin / Upload" onClick={() => setIsAdminView(true)} />}
                <MenuAction icon={Settings} label="Settings" onClick={() => {}} />
                <MenuAction icon={LogOut} label="Log Out" onClick={logout} danger />
             </div>
           </motion.div>
          )
        )}
      </main>

      <BottomNav active={currentTab} onChange={setCurrentTab as any} />

      <AnimatePresence>
        {playingVideo && (
          <VideoPlayerView video={playingVideo} onClose={() => setPlayingVideo(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

const Star = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const MenuAction = ({ icon: Icon, label, count, onClick, danger }: { icon: React.ElementType, label: string, count?: string, onClick?: () => void, danger?: boolean }) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between p-5 rounded-3xl border border-white/5 transition-all group",
      danger ? "hover:bg-red-500/10 grayscale-[0.5] hover:grayscale-0" : "bg-zinc-900/30 hover:bg-zinc-800/50"
    )}
  >
    <div className="flex items-center gap-4">
      <div className={cn("p-2 rounded-xl group-hover:scale-110 transition-transform", danger ? "bg-red-500/10 text-red-500" : "bg-zinc-800 text-zinc-400 group-hover:text-green-500")}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={cn("font-bold text-sm uppercase tracking-widest", danger ? "text-red-500" : "text-zinc-200")}>{label}</span>
    </div>
    {count ? <span className="text-zinc-500 font-black italic">{count}</span> : <ChevronRight className="w-5 h-5 text-zinc-600" />}
  </button>
);
