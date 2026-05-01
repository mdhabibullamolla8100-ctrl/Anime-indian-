import { useState, useEffect, useRef } from 'react';
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
  Crown,
  Heart,
  Camera,
  Check,
  Subtitles
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
  getDocFromServer,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  deleteDoc
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
  captionsUrl?: string;
  uploaderId: string;
  uploaderName: string;
  uploaderPhoto: string;
  views: number;
  likedBy?: string[];
  language?: string;
  ranking?: number;
  type?: 'video' | 'short';
  createdAt: { toDate: () => Date } | null;
}

interface NotificationData {
  id: string;
  title: string;
  message: string;
  createdAt: { toDate: () => Date } | null;
}

// --- Components ---

const AdminPanelView = ({ user, videos, onBack, onComplete }: { user: User, videos: VideoData[], onBack: () => void, onComplete: () => void }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [url, setUrl] = useState('');
  const [captionsUrl, setCaptionsUrl] = useState('');
  const [videoType, setVideoType] = useState('video');
  const [language, setLanguage] = useState('Hindi');
  const [loading, setLoading] = useState(false);

  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setThumbnail('');
    setUrl('');
    setCaptionsUrl('');
    setVideoType('video');
    setLanguage('Hindi');
    setEditingVideoId(null);
  };

  const handleEdit = (v: VideoData) => {
    setTitle(v.title);
    setDescription(v.description);
    setThumbnail(v.thumbnail);
    setUrl(v.url);
    setCaptionsUrl(v.captionsUrl || '');
    setVideoType(v.type || 'video');
    setLanguage(v.language || 'Hindi');
    setEditingVideoId(v.id);
    setActiveTab('upload');
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this video?")) {
      try {
        await deleteDoc(doc(db, 'videos', id));
        onComplete();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingVideoId) {
        const ref = doc(db, 'videos', editingVideoId);
        await updateDoc(ref, {
          title,
          description,
          thumbnail,
          url,
          captionsUrl,
          type: videoType,
          language
        });
      } else {
        // 1. Create Video
        await addDoc(collection(db, 'videos'), {
          title,
          description,
          thumbnail,
          url,
          captionsUrl,
          type: videoType,
          language,
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
      }
      
      onComplete();
      if (!editingVideoId) resetForm();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-6 py-10 pb-24"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
          <Upload className="w-6 h-6 text-green-500" /> Admin Panel
        </h2>
        <button onClick={onBack} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 mb-6 bg-zinc-900 p-1 rounded-xl">
         <button onClick={() => { setActiveTab('upload'); resetForm(); }} className={cn("flex-1 py-2 rounded-lg font-bold text-sm", activeTab === 'upload' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}>Upload / Edit</button>
         <button onClick={() => setActiveTab('manage')} className={cn("flex-1 py-2 rounded-lg font-bold text-sm", activeTab === 'manage' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}>Manage Videos</button>
      </div>

      {activeTab === 'upload' ? (
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
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Captions URL (.vtt) (Optional)</label>
            <input type="url" value={captionsUrl} onChange={(e) => setCaptionsUrl(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors" placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors">
              <option value="Hindi">Hindi</option>
              <option value="English">English</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Korean">Korean</option>
            </select>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-green-500 text-zinc-950 font-black py-4 rounded-xl mt-6 hover:bg-green-400 transition-colors disabled:opacity-50">
            {loading ? (editingVideoId ? 'SAVING...' : 'UPLOADING...') : (editingVideoId ? 'SAVE CHANGES' : 'PUBLISH VIDEO')}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {videos.filter(v => v.uploaderId === user.uid).map(v => (
            <div key={v.id} className="flex gap-3 bg-zinc-900 p-3 rounded-xl border border-white/5 items-center">
               <img src={v.thumbnail} className="w-24 h-16 object-cover rounded-md" />
               <div className="flex-1 overflow-hidden">
                 <h4 className="font-bold text-sm truncate">{v.title}</h4>
                 <p className="text-xs text-zinc-500 truncate">{v.description}</p>
                 <span className="text-[10px] uppercase font-bold text-green-500 tracking-widest">{v.type || 'video'}</span>
               </div>
               <div className="flex flex-col gap-2">
                 <button onClick={() => handleEdit(v)} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-white transition-colors">Edit</button>
                 <button onClick={() => handleDelete(v.id)} className="text-xs font-bold bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Delete</button>
               </div>
            </div>
          ))}
          {videos.filter(v => v.uploaderId === user.uid).length === 0 && (
             <p className="text-center text-zinc-500 text-sm py-10 font-bold uppercase tracking-widest">No videos uploaded</p>
          )}
        </div>
      )}
    </motion.div>
  );
};

const SettingsItem = ({ label, description, value, showArrow, toggle, onClick }: { label: string, description?: string, value?: string, showArrow?: boolean, toggle?: boolean, onClick?: () => void }) => {
  const [isOn, setIsOn] = useState(true);
  return (
    <button onClick={onClick || (toggle ? () => setIsOn(!isOn) : undefined)} className="w-full text-left p-4 hover:bg-zinc-800/50 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between gap-4">
      <div className="flex-1">
         <span className="font-bold text-zinc-200 block">{label}</span>
         {description && <span className="text-xs text-zinc-500 mt-1 block leading-relaxed">{description}</span>}
      </div>
      <div className="flex items-center gap-2">
         {value && <span className="text-zinc-500 text-sm">{value}</span>}
         {toggle && (
           <div className={cn("w-12 h-6 rounded-full p-1 transition-colors relative", isOn ? "bg-green-500" : "bg-zinc-700")}>
             <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", isOn ? "translate-x-6" : "translate-x-0")} />
           </div>
         )}
         {showArrow && <ChevronRight className="w-5 h-5 text-zinc-600" />}
      </div>
    </button>
  );
};

const WatchHistoryView = ({ historyVideos, onClose, onVideoSelect }: { historyVideos: VideoData[], onClose: () => void, onVideoSelect: (v: VideoData) => void }) => (
  <motion.div 
    initial={{ opacity: 0, x: '100%' }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: '100%' }}
    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    className="fixed inset-0 sm:max-w-md sm:mx-auto z-[120] bg-zinc-950 flex flex-col sm:border-x sm:border-white/10"
  >
    <div className="sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10 px-4 py-4 flex items-center border-b border-white/5">
      <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors mr-2">
        <ChevronRight className="w-6 h-6 rotate-180" />
      </button>
      <h1 className="text-xl font-bold uppercase tracking-widest text-zinc-100 italic">Watch History</h1>
    </div>
    
    <div className="flex-1 overflow-y-auto p-4 pb-20">
      {historyVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
           <History className="w-16 h-16 text-zinc-800 mb-4" />
           <p className="text-zinc-500 font-bold uppercase tracking-widest">No watch history</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {historyVideos.map(v => (
            <MovieCard key={v.id} video={v} onClick={() => onVideoSelect(v)} />
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

const SettingsView = ({ onClose, onLogout }: { onClose: () => void, onLogout: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, x: '100%' }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: '100%' }}
    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    className="fixed inset-0 sm:max-w-md sm:mx-auto z-50 bg-zinc-950 overflow-y-auto sm:border-x sm:border-white/10"
  >
    <div className="sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10 px-4 py-4 flex items-center border-b border-white/5">
      <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors mr-2">
        <ChevronRight className="w-6 h-6 rotate-180" />
      </button>
      <h1 className="text-lg font-bold flex-1 text-center pr-10">Settings</h1>
    </div>

    <div className="p-4 space-y-6">
       <div>
         <h2 className="text-sm text-zinc-500 font-bold mb-2 px-2 uppercase tracking-widest">Your app and preferences</h2>
         <div className="bg-zinc-900/50 rounded-2xl border border-white/5 overflow-hidden">
           <SettingsItem label="Notifications" showArrow />
           <SettingsItem label="Language" showArrow />
           <SettingsItem label="Watch Options" value="Streaming" showArrow />
           <SettingsItem label="Family Mode" description="This helps hide potentially mature videos. No filter is 100% accurate." toggle={true} />
           <SettingsItem label="Download in background" toggle={true} />
           <SettingsItem label="Auto activate Miniplayer" description="When enabled, switching pages during playback will automatically enable Miniplayer." toggle={true} />
           <SettingsItem label="Privacy Settings" showArrow />
         </div>
       </div>

       <div>
         <h2 className="text-sm text-zinc-500 font-bold mb-2 px-2 uppercase tracking-widest">More info and support</h2>
         <div className="bg-zinc-900/50 rounded-2xl border border-white/5 overflow-hidden">
           <SettingsItem label="Check update" showArrow />
           <SettingsItem label="About us" showArrow />
           <SettingsItem label="Privacy Policy" showArrow />
           <SettingsItem label="User Agreement" showArrow />
           <SettingsItem label="Log out" showArrow onClick={onLogout} />
         </div>
       </div>
    </div>
  </motion.div>
);

const EditProfileView = ({ user, onClose }: { user: User | null, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, x: '100%' }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: '100%' }}
    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    className="fixed inset-0 sm:max-w-md sm:mx-auto z-[110] bg-zinc-950 flex flex-col sm:border-x sm:border-white/10"
  >
    <div className="flex items-center justify-between p-4 border-b border-white/5">
      <button onClick={onClose} className="p-2 -ml-2 text-zinc-300 hover:text-white">
        <ChevronRight className="w-6 h-6 rotate-180" />
      </button>
      <h1 className="text-lg font-bold">Edit Profile</h1>
      <button className="text-green-500 font-bold px-2 py-1 text-sm bg-transparent hover:bg-white/5 transition-colors rounded">
        Done
      </button>
    </div>

    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'Guest'}`} alt="Profile" className="w-32 h-32 rounded-full object-cover border border-white/10" />
          <div className="absolute bottom-1 right-1 w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-600 shadow-xl cursor-pointer hover:bg-zinc-700 transition">
             <Camera className="w-4 h-4 text-zinc-300" />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 cursor-pointer group">
           <span className="font-bold text-lg uppercase tracking-tight">{user?.displayName || 'Guest'}</span>
           <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition" />
        </div>
      </div>

      <div className="space-y-6 mt-8">
        <div className="flex items-center justify-between pb-4 border-b border-white/5 cursor-pointer group">
          <span className="text-zinc-300">Gender</span>
          <span className="text-zinc-500 flex items-center gap-1 group-hover:text-white transition">Not set <ChevronRight className="w-4 h-4" /></span>
        </div>
        <div className="flex items-center justify-between pb-4 cursor-pointer group">
          <span className="text-zinc-300">Date of Birth</span>
          <span className="text-zinc-500 flex items-center gap-1 group-hover:text-white transition">Not set <ChevronRight className="w-4 h-4" /></span>
        </div>
      </div>
    </div>
  </motion.div>
);

const PremiumView = ({ user }: { user: User | null }) => (
  <div className="animate-fade-in pb-20">
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Premium</h1>
        <button className="text-zinc-400 text-sm flex items-center gap-1">Promo Code <ChevronRight className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'User'}`} className="w-10 h-10 rounded-full" />
        <span className="font-bold text-lg uppercase tracking-tight">{user?.displayName || 'Guest'}</span>
      </div>

      {/* Trial Banner */}
      <div className="relative bg-gradient-to-r from-amber-600 to-amber-900 rounded-2xl p-6 overflow-hidden mb-8 border border-amber-500/30">
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-amber-300 italic drop-shadow-lg mb-2">Premium Trial</h2>
          <div className="inline-flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs font-bold text-amber-400">
            <Crown className="w-3 h-3 text-amber-400" /> 24 days left
          </div>
        </div>
        <div className="absolute top-4 right-4 z-10">
           <div className="bg-black/50 px-3 py-1.5 rounded-full flex items-center gap-1">
             <Star className="w-4 h-4 text-amber-400" />
             <span className="font-bold text-amber-400">70 <ChevronRight className="w-3 h-3 inline" /></span>
           </div>
        </div>
        <Crown className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
      </div>

      <div className="text-center mb-6">
        <button className="text-amber-500 font-bold flex items-center justify-center gap-1 w-full uppercase tracking-widest text-sm">
          Redeem & Win <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Extent Benefits Block */}
      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-amber-500/10">
        <h3 className="text-center text-amber-500 font-bold mb-6 text-lg">Extend your Premium benefits</h3>
        
        <div className="flex justify-between items-center mb-8 px-2">
           <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 relative">
                 <span className="font-black italic">AD</span>
                 <div className="absolute w-[2px] h-8 bg-amber-500 rotate-45" />
              </div>
              <span className="text-xs font-bold text-zinc-300">No ads</span>
           </div>
           <span className="text-zinc-700 font-bold">+</span>
           <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                 <span className="font-black italic">HD</span>
              </div>
              <span className="text-xs font-bold text-zinc-300">720p quality</span>
           </div>
           <span className="text-zinc-700 font-bold">+</span>
           <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                 <Download className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-zinc-300">Multi-downloads</span>
           </div>
        </div>

        {/* Buy options */}
        <div className="grid grid-cols-3 gap-3 mb-6">
           <div className="bg-zinc-800 rounded-xl overflow-hidden flex flex-col text-center border border-white/5">
              <div className="p-3">
                 <div className="text-zinc-400 text-xs font-bold">1 month</div>
                 <div className="text-xl font-black mt-1 text-white">₹53</div>
                 <div className="text-[9px] text-zinc-500 mt-1 uppercase">1-time-payment</div>
              </div>
              <button className="bg-amber-500 text-black font-bold py-2 text-sm hover:bg-amber-400">Buy Now</button>
           </div>
           <div className="bg-zinc-800 rounded-xl overflow-hidden flex flex-col text-center shadow-[0_0_15px_rgba(245,158,11,0.2)] border border-amber-500/30">
              <div className="p-3 bg-zinc-800">
                 <div className="text-zinc-400 text-xs font-bold">3 month</div>
                 <div className="text-xl font-black mt-1 text-white">₹132</div>
                 <div className="text-[9px] text-zinc-500 mt-1 uppercase">1-time-payment</div>
              </div>
              <button className="bg-amber-500 text-black font-bold py-2 text-sm hover:bg-amber-400">Buy Now</button>
           </div>
           <div className="bg-zinc-800 rounded-xl overflow-hidden flex flex-col text-center border border-white/5">
              <div className="p-3">
                 <div className="text-zinc-400 text-xs font-bold">12 month</div>
                 <div className="text-xl font-black mt-1 text-white">₹396</div>
                 <div className="text-[9px] text-zinc-500 mt-1 uppercase">1-time-payment</div>
              </div>
              <button className="bg-amber-500 text-black font-bold py-2 text-sm hover:bg-amber-400">Buy Now</button>
           </div>
        </div>

        <div className="relative text-center mb-6">
           <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
           <span className="relative bg-zinc-900 px-4 text-xs font-bold text-zinc-500 uppercase">OR</span>
        </div>

        {/* Redeem options */}
        <div className="grid grid-cols-3 gap-3">
           <div className="bg-zinc-800 rounded-xl overflow-hidden flex flex-col text-center border border-white/5">
              <div className="p-4">
                 <div className="text-zinc-400 text-xs font-bold mb-2">1 day</div>
                 <div className="flex items-center justify-center gap-1">
                   <Star className="w-4 h-4 text-amber-500" />
                   <span className="text-xl font-black text-white">5</span>
                 </div>
              </div>
              <button className="bg-amber-500 text-black font-bold py-2 text-sm hover:bg-amber-400">Redeem</button>
           </div>
           <div className="bg-zinc-800 rounded-xl overflow-hidden flex flex-col text-center border border-white/5">
              <div className="p-4">
                 <div className="text-zinc-400 text-xs font-bold mb-2">7 day</div>
                 <div className="flex items-center justify-center gap-1">
                   <Star className="w-4 h-4 text-amber-500" />
                   <span className="text-xl font-black text-white">15</span>
                 </div>
              </div>
              <button className="bg-amber-500 text-black font-bold py-2 text-sm hover:bg-amber-400">Redeem</button>
           </div>
           <div className="bg-zinc-800 rounded-xl overflow-hidden flex flex-col text-center border border-white/5">
              <div className="p-4">
                 <div className="text-zinc-400 text-xs font-bold mb-2">30 day</div>
                 <div className="flex items-center justify-center gap-1">
                   <Star className="w-4 h-4 text-amber-500" />
                   <span className="text-xl font-black text-white">45</span>
                 </div>
              </div>
              <button className="bg-amber-500 text-black font-bold py-2 text-sm hover:bg-amber-400">Redeem</button>
           </div>
        </div>
      </div>

      <div className="mt-8 text-center pb-8 border-b border-white/10">
         <h3 className="text-amber-500 font-bold text-lg mb-6">Complete tasks to get points</h3>
         
         <div className="text-left">
           <h4 className="font-bold mb-4 text-white">Check-in daily</h4>
           <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4">
             {/* Day 1 - Done */}
             <div className="shrink-0 w-[4.5rem] bg-zinc-800/40 rounded-xl flex flex-col items-center border border-white/5 overflow-hidden">
                <div className="w-full py-2 flex flex-col items-center justify-center border-b border-white/5 bg-zinc-900/50">
                  <Star className="w-5 h-5 text-amber-600 mb-1" />
                  <span className="font-bold text-xs text-amber-600/80">+2</span>
                </div>
                <div className="w-full py-1.5 flex justify-center items-center bg-zinc-800/20">
                  <Check className="w-4 h-4 text-amber-600/80" />
                </div>
             </div>

             {/* Day 2 - Done */}
             <div className="shrink-0 w-[4.5rem] bg-zinc-800/40 rounded-xl flex flex-col items-center border border-white/5 overflow-hidden">
                <div className="w-full py-2 flex flex-col items-center justify-center border-b border-white/5 bg-zinc-900/50">
                  <Star className="w-5 h-5 text-amber-600 mb-1" />
                  <span className="font-bold text-xs text-amber-600/80">+2</span>
                </div>
                <div className="w-full py-1.5 flex justify-center items-center bg-zinc-800/20">
                  <Check className="w-4 h-4 text-amber-600/80" />
                </div>
             </div>

             {/* Day 3 - Claim */}
             <div className="shrink-0 w-[4.5rem] rounded-xl flex flex-col items-center border border-amber-500 overflow-hidden shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <div className="w-full py-2 flex flex-col items-center justify-center bg-zinc-900 border-b border-amber-500/20">
                  <Star className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="font-bold text-xs text-white">+2</span>
                </div>
                <div className="w-full py-1.5 flex justify-center items-center bg-amber-500 cursor-pointer">
                  <span className="font-bold text-xs text-black">Claim</span>
                </div>
             </div>

             {/* Day 4 - Future */}
             <div className="shrink-0 w-[4.5rem] bg-zinc-800/50 rounded-xl flex flex-col items-center border border-white/5 overflow-hidden opacity-70">
                <div className="w-full py-2 flex flex-col items-center justify-center border-b border-white/5">
                  <Star className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="font-bold text-xs text-white">+2</span>
                </div>
                <div className="w-full py-1.5 flex justify-center items-center bg-zinc-700/50">
                  <span className="font-medium text-[10px] text-zinc-400">Day4</span>
                </div>
             </div>

             {/* Day 5 - Future */}
             <div className="shrink-0 w-[4.5rem] bg-zinc-800/50 rounded-xl flex flex-col items-center border border-white/5 overflow-hidden opacity-70">
                <div className="w-full py-2 flex flex-col items-center justify-center border-b border-white/5">
                  <Star className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="font-bold text-xs text-white">+2</span>
                </div>
                <div className="w-full py-1.5 flex justify-center items-center bg-zinc-700/50">
                  <span className="font-medium text-[10px] text-zinc-400">Day5</span>
                </div>
             </div>

             {/* Day 6 - Future */}
             <div className="shrink-0 w-[4.5rem] bg-zinc-800/50 rounded-xl flex flex-col items-center border border-white/5 overflow-hidden opacity-70">
                <div className="w-full py-2 flex flex-col items-center justify-center border-b border-white/5">
                  <Star className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="font-bold text-xs text-white">+2</span>
                </div>
                <div className="w-full py-1.5 flex justify-center items-center bg-zinc-700/50">
                  <span className="font-medium text-[10px] text-zinc-400">Day6</span>
                </div>
             </div>

             {/* Day 7 - Future Big */}
             <div className="shrink-0 w-[8rem] bg-zinc-800/50 rounded-xl flex flex-col items-center border border-white/5 overflow-hidden opacity-70">
                <div className="w-full py-2 flex flex-col items-center justify-center border-b border-white/5">
                  <div className="flex items-center gap-1 mb-1">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-xs text-white">+1days</span>
                  </div>
                </div>
                <div className="w-full flex-1 flex justify-center items-center bg-zinc-700/50 min-h-[24px]">
                  <span className="font-medium text-[10px] text-zinc-400">Day7</span>
                </div>
             </div>

           </div>
         </div>
      </div>

    </div>
  </div>
);

const TopNav = ({ searchQuery, setSearchQuery, notifications, showNotifications, setShowNotifications }: { 
  searchQuery: string, 
  setSearchQuery: (q: string) => void, 
  notifications: NotificationData[],
  showNotifications: boolean,
  setShowNotifications: (v: boolean) => void
}) => (
  <nav className="fixed top-0 left-0 right-0 sm:max-w-md sm:mx-auto h-14 glass z-50 flex items-center justify-between px-4 sm:px-6 sm:border-x sm:border-white/10">
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

const VideoPlayerView = ({ video, allVideos, onVideoSelect, onClose, currentUser, onLike }: { video: VideoData, allVideos: VideoData[], onVideoSelect: (v: VideoData) => void, onClose: () => void, currentUser: User | null, onLike: () => void }) => {
  const hasLiked = currentUser && video.likedBy?.includes(currentUser.uid);
  const likesCount = video.likedBy?.length || 0;
  const [speed, setSpeed] = useState(1);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const relatedVideos = allVideos.filter(v => v.id !== video.id && (v.type === video.type || v.uploaderId === video.uploaderId)).slice(0, 10);

  const handleDownload = async () => {
    if (!video.url) {
      alert("This video is not available for download.");
      return;
    }
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      const response = await fetch(video.url);
      if (!response.ok) throw new Error('Network response was not ok.');
      
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);
      
      let loaded = 0;
      const reader = response.body?.getReader();
      const chunks: BlobPart[] = [];

      if (reader) {
          // eslint-disable-next-line no-constant-condition
          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                  chunks.push(value);
                  loaded += value.length;
                  if (total) {
                      setDownloadProgress(Math.round((loaded / total) * 100));
                  }
              }
          }
          
          const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = video.title ? `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4` : 'video.mp4';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      } else {
         throw new Error("No reader");
      }
    } catch (e) {
      // Fallback for CORS issues
      const a = document.createElement('a');
      a.href = video.url;
      a.download = video.title ? `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4` : 'video.mp4';
      a.target = '_blank';
      a.click();
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
  };

  return (
  <motion.div 
    initial={{ opacity: 0, y: '100%' }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: '100%' }}
    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    className="fixed inset-0 sm:max-w-md sm:mx-auto z-[100] bg-zinc-950 flex flex-col sm:border-x sm:border-white/10"
  >
    {/* Main Video Container */}
    <div className="relative w-full aspect-video bg-black flex-shrink-0 group">
      {/* Close Button */}
      <button onClick={onClose} className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/50 backdrop-blur-md flex items-center justify-center rounded-full hover:bg-white/20 transition-all border border-white/10 opacity-100 group-hover:opacity-100 sm:opacity-0">
        <ChevronRight className="w-6 h-6 rotate-180" />
      </button>
      
      {/* Speed & CC Controls Overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-1 opacity-100 group-hover:opacity-100 sm:opacity-0 transition-opacity bg-black/50 backdrop-blur-md rounded-lg p-1 border border-white/10 items-center">
        {video.captionsUrl && (
          <button
            onClick={() => setShowCaptions(!showCaptions)}
            className={cn(
              "px-2 py-1 text-xs font-bold rounded-md transition-all flex items-center justify-center",
              showCaptions ? "bg-amber-500 text-black" : "text-white hover:bg-white/20"
            )}
            title="Toggle Captions"
          >
            <Subtitles className="w-4 h-4" />
          </button>
        )}
        <div className="w-px h-4 bg-white/20 mx-1" />
        {[0.5, 1, 1.5, 2].map((s) => (
          <button
            key={s}
            onClick={() => handleSpeedChange(s)}
            className={cn(
              "px-2 py-1 text-xs font-bold rounded-md transition-all",
              speed === s ? "bg-white text-black" : "text-white hover:bg-white/20"
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      {video.url ? (
        <video 
          ref={videoRef}
          src={video.url} 
          poster={video.thumbnail} 
          controls 
          autoPlay 
          crossOrigin="anonymous"
          className="w-full h-full"
        >
          {video.captionsUrl && showCaptions && (
             <track kind="captions" src={video.captionsUrl} srcLang="en" label="English" default />
          )}
        </video>
      ) : (
        <>
          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
              <Play className="w-8 h-8 fill-white text-white ml-1" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-red-600 w-1/3 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full shadow" />
            </div>
          </div>
        </>
      )}
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

      {/* Quick Actions (Like, My List, Download) */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button 
          onClick={onLike}
          className={cn(
            "flex-1 transition-all py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest border border-white/5",
            hasLiked ? "bg-red-600 hover:bg-red-500 text-white" : "bg-white/10 hover:bg-white/20"
          )}
        >
          <Heart className={cn("w-4 h-4", hasLiked && "fill-current")} /> 
          {likesCount > 0 ? likesCount : 'Like'}
        </button>
        <button className="flex-1 bg-white/10 hover:bg-white/20 transition-all py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest border border-white/5">
          <Plus className="w-4 h-4" /> My List
        </button>
        <button onClick={handleDownload} disabled={isDownloading} className="relative overflow-hidden flex-1 bg-white/10 hover:bg-white/20 transition-all py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest border border-white/5 disabled:opacity-80">
          {isDownloading && (
            <div className="absolute inset-0 bg-green-600/20" style={{ width: `${downloadProgress}%` }} />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <Download className="w-4 h-4" /> 
            {isDownloading ? (downloadProgress > 0 ? `Downloading ${downloadProgress}%` : 'Downloading...') : 'Download'}
          </span>
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

      {/* Related Videos */}
      {relatedVideos.length > 0 && (
        <div className="pt-8 border-t border-white/10">
          <h2 className="text-lg font-bold mb-4 uppercase tracking-widest text-zinc-400">Related Videos</h2>
          <div className="grid grid-cols-2 gap-4">
            {relatedVideos.map(v => (
              <div key={v.id} onClick={() => onVideoSelect(v)} className="cursor-pointer group flex flex-col gap-2">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/5">
                   <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                   <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition" />
                </div>
                <div>
                  <h3 className="text-xs font-bold line-clamp-1">{v.title}</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{v.views.toLocaleString()} Views</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </motion.div>
  );
};

const BottomNav = ({ active, onChange }: { active: string, onChange: (v: string) => void }) => (
  <nav className="fixed bottom-0 left-0 right-0 sm:max-w-md sm:mx-auto h-16 bg-zinc-950 border-t border-white/10 flex items-center justify-around px-4 z-50 sm:border-x sm:border-white/10">
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
  const [currentLanguage, setCurrentLanguage] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [playingVideo, setPlayingVideo] = useState<VideoData | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isSettingsView, setIsSettingsView] = useState(false);
  const [isEditProfileView, setIsEditProfileView] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [userHistory, setUserHistory] = useState<VideoData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLike = async (videoToLike: VideoData) => {
    if (!user) return alert("Please sign in to like videos!");
    const isLiked = videoToLike.likedBy?.includes(user.uid);
    const videoRef = doc(db, 'videos', videoToLike.id);
    try {
      if (isLiked) {
        await updateDoc(videoRef, {
          likedBy: arrayRemove(user.uid)
        });
        setVideos(prev => prev.map(v => v.id === videoToLike.id ? { ...v, likedBy: (v.likedBy || []).filter(uid => uid !== user.uid) } : v));
        if (playingVideo?.id === videoToLike.id) {
          setPlayingVideo(prev => prev ? { ...prev, likedBy: (prev.likedBy || []).filter(uid => uid !== user.uid) } : null);
        }
      } else {
        await updateDoc(videoRef, {
          likedBy: arrayUnion(user.uid)
        });
        setVideos(prev => prev.map(v => v.id === videoToLike.id ? { ...v, likedBy: [...(v.likedBy || []), user.uid] } : v));
        if (playingVideo?.id === videoToLike.id) {
          setPlayingVideo(prev => prev ? { ...prev, likedBy: [...(prev.likedBy || []), user.uid] } : null);
        }
      }
    } catch (error) {
      console.error("Error liking video:", error);
    }
  };

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

  useEffect(() => {
    if (!user) {
      setUserHistory([]);
      return;
    }
    const historyRef = collection(db, 'users', user.uid, 'history');
    const q = query(historyRef, orderBy('viewedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoData)));
    }, (err) => {
      console.error(err);
    });
    return () => unsubscribe();
  }, [user]);

  const handleVideoSelect = async (v: VideoData) => {
    setPlayingVideo(v);
    if (user) {
      try {
        const historyRef = doc(db, 'users', user.uid, 'history', v.id);
        await setDoc(historyRef, {
          ...v,
          viewedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error updating history", err);
      }
    }
  };

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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950 sm:max-w-md sm:mx-auto sm:border-x sm:border-white/10">
        <div className="w-10 h-10 border-2 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-zinc-500 font-black uppercase tracking-tighter text-[10px] transition-pulse">Loading Cinematic Experience</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 sm:max-w-md sm:mx-auto sm:border-x sm:border-white/10 relative shadow-2xl">
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
                    <MovieCard key={v.id} video={v} onClick={() => handleVideoSelect(v)} />
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

                {/* Languages and Content */}
                <div className="py-8 space-y-2">
                  <div className="px-6 mb-6">
                     <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black uppercase tracking-tighter">Languages</h2>
                        <Filter className="w-5 h-5 text-zinc-500 cursor-pointer" />
                     </div>
                     <div className="flex gap-3 mt-4 overflow-x-auto hide-scrollbar">
                        {['All', 'Hindi', 'English', 'Tamil', 'Telugu', 'Korean'].map(lang => (
                          <div 
                            key={lang} 
                            onClick={() => setCurrentLanguage(lang)}
                            className="flex-shrink-0 relative group cursor-pointer"
                          >
                            <div className={cn("w-32 h-16 rounded-xl overflow-hidden transition-all duration-500", currentLanguage === lang ? "ring-2 ring-green-500 grayscale-0" : "grayscale group-hover:grayscale-0")}>
                              <img src={`https://images.unsplash.com/photo-${lang === 'Hindi' ? '1585951237318-9ea5e175b891' : '1509281373149-e957c6296406'}?auto=format&fit=crop&q=40&w=200`} className="w-full h-full object-cover" />
                              <div className={cn("absolute inset-0 transition-all flex items-center justify-center", currentLanguage === lang ? "bg-green-500/20" : "bg-black/40 group-hover:bg-green-500/20")}>
                                <span className={cn("text-xs font-black uppercase tracking-widest drop-shadow-md", currentLanguage === lang ? "text-white" : "text-zinc-300 group-hover:text-white")}>{lang}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                     </div>
                  </div>

                  <Section title="Rankings" videos={videos.filter(v => (!currentCategory || currentCategory === 'Trending' || currentCategory === 'All' || v.type === currentCategory) && (currentLanguage === 'All' || (v.language || 'Hindi') === currentLanguage))} ranking onVideoSelect={handleVideoSelect} />
                  <Section title="Cinema" videos={videos.filter(v => (!currentCategory || currentCategory === 'Trending' || currentCategory === 'All' || v.type === currentCategory) && (currentLanguage === 'All' || (v.language || 'Hindi') === currentLanguage))} onVideoSelect={handleVideoSelect} />
                  <Section title="Recommended for You" videos={videos.filter(v => (!currentCategory || currentCategory === 'Trending' || currentCategory === 'All' || v.type === currentCategory) && (currentLanguage === 'All' || (v.language || 'Hindi') === currentLanguage)).slice().reverse()} onVideoSelect={handleVideoSelect} />
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === 'premium' && (
          <PremiumView user={user} />
        )}

        {currentTab === 'downloads' && (
          <div className="animate-fade-in p-6 pt-20 text-center">
            <Download className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Downloads Yet</h2>
            <p className="text-zinc-500 text-sm">Videos you download will appear here.</p>
          </div>
        )}

        {currentTab === 'me' && (
          isAdminView ? (
            user && <AdminPanelView user={user} videos={videos} onBack={() => setIsAdminView(false)} onComplete={() => { setIsAdminView(false); fetchGlobalVideos(); }} />
          ) : (
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-6 pb-20"
           >
             <div className="flex items-center gap-6 mb-6 cursor-pointer" onClick={() => setIsEditProfileView(true)}>
                <div className="relative group">
                  <img src={user?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'} alt="" className="w-20 h-20 rounded-full border border-white/20 p-0.5 object-cover" />
                </div>
                <div>
                  <h2 className="text-xl font-bold uppercase flex items-center gap-2">{user?.displayName || 'Guest User'} <ChevronRight className="w-5 h-5 text-zinc-500" /></h2>
                  <p className="text-zinc-400 text-xs mt-1">ID: {user?.uid.slice(0, 8) || '00000000'}</p>
                  {!user && (
                    <button onClick={(e) => { e.stopPropagation(); signInWithGoogle(); }} className="mt-2 bg-green-500 text-zinc-950 px-4 py-1.5 rounded-lg font-bold text-xs hover:bg-green-400 transition-all">SIGN IN</button>
                  )}
                </div>
             </div>

             <div className="bg-zinc-800/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between mb-2 cursor-pointer transition-colors hover:bg-zinc-800/60" onClick={() => setCurrentTab('premium')}>
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
                <MenuAction icon={Star} label="Rewards Center" onClick={() => setCurrentTab('premium')} />
             </div>

             <div className="space-y-1 mt-4">
                <MenuAction icon={Bookmark} label="My List" count="0" onClick={() => {}} />
                <MenuAction icon={ThumbsUp} label="My Likes" count="0" onClick={() => {}} />
             </div>

             <div className="mt-4">
                <div onClick={() => setIsHistoryView(true)} className="flex items-center justify-between px-2 mb-3 cursor-pointer group">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-zinc-200 group-hover:text-white transition"><History className="w-4 h-4" /> Watch History</h3>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar px-2 pb-2">
                  {userHistory.slice(0, 4).map(v => (
                    <div onClick={() => handleVideoSelect(v)} key={v.id} className="cursor-pointer relative w-32 shrink-0 aspect-[16/9] rounded-lg overflow-hidden group">
                      <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute inset-x-0 bottom-0 py-1 px-2 bg-gradient-to-t from-black to-transparent">
                        <p className="text-[10px] font-bold text-white truncate">{v.title}</p>
                      </div>
                    </div>
                  ))}
                  {userHistory.length === 0 && (
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 py-4 px-2">No history</div>
                  )}
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
                <MenuAction icon={Settings} label="Settings" onClick={() => setIsSettingsView(true)} />
                <MenuAction icon={LogOut} label="Log Out" onClick={logout} danger />
             </div>
           </motion.div>
          )
        )}
      </main>

      <BottomNav active={currentTab} onChange={(v) => setCurrentTab(v as 'home' | 'me' | 'downloads' | 'premium')} />

      <AnimatePresence>
        {playingVideo && (
          <VideoPlayerView 
            video={playingVideo} 
            allVideos={videos}
            onVideoSelect={handleVideoSelect}
            onClose={() => setPlayingVideo(null)} 
            currentUser={user} 
            onLike={() => handleLike(playingVideo)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsView && (
          <SettingsView onClose={() => setIsSettingsView(false)} onLogout={logout} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHistoryView && (
          <WatchHistoryView historyVideos={userHistory} onClose={() => setIsHistoryView(false)} onVideoSelect={handleVideoSelect} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditProfileView && (
          <EditProfileView user={user} onClose={() => setIsEditProfileView(false)} />
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
