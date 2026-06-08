import React, { useState, useEffect, useMemo, useRef } from 'react';
import myLogo from './favicon.png';
import { 
  Search, Plus, Upload, Moon, Sun, Menu, 
  Trash2, Edit2, Loader2, Cloud, CheckCircle2, AlertCircle,
  Pin, Settings, Lock, CloudCog, Github, GitFork, MoreVertical,
  QrCode, Copy, LayoutGrid, List, Check, ExternalLink, ArrowRight
} from 'lucide-react';
import { 
    LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, 
    WebDavConfig, AIConfig, SiteSettings, SearchEngine, DEFAULT_SEARCH_ENGINES 
} from './types';
import Icon from './components/Icon';
import LinkModal from './components/LinkModal';
import AuthModal from './components/AuthModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import SearchSettingsModal from './components/SearchSettingsModal';

const GITHUB_REPO_URL = 'https://github.com/sese972010/CloudNav-';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';
const SEARCH_ENGINES_KEY = 'cloudnav_search_engines';

function App() {
  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Search State
  const [searchMode, setSearchMode] = useState<'local' | 'external'>('local');
  const [externalEngines, setExternalEngines] = useState<SearchEngine[]>(() => {
      const saved = localStorage.getItem(SEARCH_ENGINES_KEY);
      if (saved) {
          try { return JSON.parse(saved); } catch(e) {}
      }
      // Filter out 'local' from defaults for the external list
      return DEFAULT_SEARCH_ENGINES.filter(e => e.id !== 'local');
  });
  const [activeEngineId, setActiveEngineId] = useState<string>(() => {
      return externalEngines[0]?.id || 'google';
  });
  const [isSearchSettingsOpen, setIsSearchSettingsOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Site Settings - Initialized with defaults to prevent crash
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
      title: '龙航',
      navTitle: '龙航',
      favicon: '/favicon.png',
      cardStyle: 'detailed'
  });
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, link: LinkItem | null } | null>(null);
  
  const [qrCodeLink, setQrCodeLink] = useState<LinkItem | null>(null);

  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
      url: '',
      username: '',
      password: '',
      enabled: false
  });

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
      const saved = localStorage.getItem(AI_CONFIG_KEY);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {}
      }
      
      // Safe access to process env
      let defaultKey = '';
      try {
          if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
              defaultKey = process.env.API_KEY;
          }
      } catch(e) {}

      return {
          provider: 'gemini',
          apiKey: defaultKey, 
          baseUrl: '',
          model: 'gemini-2.5-flash'
      };
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');

  const mainRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLinks(parsed.links || INITIAL_LINKS);
        setCategories(parsed.categories || DEFAULT_CATEGORIES);
        if (parsed.settings) setSiteSettings(prev => ({ ...prev, ...parsed.settings }));
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], newSettings: SiteSettings, token: string) => {
    setSyncStatus('saving');
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': token
            },
            body: JSON.stringify({ links: newLinks, categories: newCategories, settings: newSettings })
        });

        if (response.status === 401) {
            setAuthToken('');
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setSyncStatus('error');
            return false;
        }

        if (!response.ok) throw new Error('Network response was not ok');
        
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
    } catch (error) {
        console.error("Sync failed", error);
        setSyncStatus('error');
        return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[], newSettings: SiteSettings = siteSettings) => {
      setLinks(newLinks);
      setCategories(newCategories);
      setSiteSettings(newSettings);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories, settings: newSettings }));
      if (authToken) {
          syncToCloud(newLinks, newCategories, newSettings, authToken);
      }
  };

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
        try {
            setWebDavConfig(JSON.parse(savedWebDav));
        } catch (e) {}
    }

    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
        const addTitle = urlParams.get('add_title') || '';
        window.history.replaceState({}, '', window.location.pathname);
        setPrefillLink({
            title: addTitle,
            url: addUrl,
            categoryId: 'common'
        });
        setEditingLink(undefined);
        setIsModalOpen(true);
    }

    const initData = async () => {
        try {
            const res = await fetch('/api/storage');
            if (res.ok) {
                const data = await res.json();
                if (data.links && data.links.length > 0) {
                    setLinks(data.links);
                    setCategories(data.categories || DEFAULT_CATEGORIES);
                    if (data.settings) setSiteSettings(prev => ({ ...prev, ...data.settings }));
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                    return;
                }
            } 
        } catch (e) {
            console.warn("Failed to fetch from cloud, falling back to local.", e);
        }
        loadFromLocal();
    };

    initData();
  }, []);

  useEffect(() => {
      document.title = siteSettings.title || 'CloudNav';
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link && siteSettings.favicon) {
          link.href = siteSettings.favicon;
      }
  }, [siteSettings]);

  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (openMenuId) setOpenMenuId(null);
          if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
             setContextMenu(null);
          }
      };
      
      const handleScroll = () => {
         if (contextMenu) setContextMenu(null);
      };

      window.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true); 
      
      const handleGlobalContextMenu = (e: MouseEvent) => {
          if (contextMenu) {
              e.preventDefault();
              setContextMenu(null);
          }
      }
      window.addEventListener('contextmenu', handleGlobalContextMenu);

      return () => {
          window.removeEventListener('click', handleClickOutside);
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('contextmenu', handleGlobalContextMenu);
      }
  }, [openMenuId, contextMenu]);

  useEffect(() => {
    const handleScroll = () => {
        if (isAutoScrollingRef.current) return;
        if (!mainRef.current) return;
        
        const scrollPosition = mainRef.current.scrollTop + 150;

        if (mainRef.current.scrollTop < 80) {
            setActiveCategory('all');
            return;
        }

        let currentCatId = 'all';
        for (const cat of categories) {
            const el = document.getElementById(`cat-${cat.id}`);
            if (el && el.offsetTop <= scrollPosition && (el.offsetTop + el.offsetHeight) > scrollPosition) {
                currentCatId = cat.id;
                break;
            }
        }
        if (currentCatId !== 'all') setActiveCategory(currentCatId);
    };

    const mainEl = mainRef.current;
    if (mainEl) mainEl.addEventListener('scroll', handleScroll);
    return () => mainEl?.removeEventListener('scroll', handleScroll);
  }, [categories]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // --- Handlers ---
  const handleLogin = async (password: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': password
            },
            body: JSON.stringify({ links, categories, settings: siteSettings })
        });
        
        if (response.ok) {
            setAuthToken(password);
            localStorage.setItem(AUTH_KEY, password);
            setIsAuthOpen(false);
            setSyncStatus('saved');
            return true;
        }
        return false;
      } catch (e) {
          return false;
      }
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
      const mergedCategories = [...categories];
      newCategories.forEach(nc => {
          if (!mergedCategories.some(c => c.id === nc.id || c.name === nc.name)) {
              mergedCategories.push(nc);
          }
      });
      const mergedLinks = [...links, ...newLinks];
      updateData(mergedLinks, mergedCategories);
      setIsImportModalOpen(false);
      alert(`成功导入 ${newLinks.length} 个新书签!`);
  };

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    const newLink: LinkItem = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    updateData([newLink, ...links], categories);
    setPrefillLink(undefined);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;
    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  const handleDeleteLink = (id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  const togglePin = (id: string) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      const updated = links.map(l => l.id === id ? { ...l, pinned: !l.pinned } : l);
      updateData(updated, categories);
  };
  
  const handleCopyLink = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const handleSaveAIConfig = (config: AIConfig, newSiteSettings: SiteSettings) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      if (authToken) {
          updateData(links, categories, newSiteSettings);
      } else {
          setSiteSettings(newSiteSettings);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories, settings: newSiteSettings }));
      }
  };

  const scrollToCategory = (catId: string) => {
      setActiveCategory(catId);
      setSidebarOpen(false);
      
      if (catId === 'all') {
          isAutoScrollingRef.current = true;
          mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => isAutoScrollingRef.current = false, 800);
          return;
      }
      const el = document.getElementById(`cat-${catId}`);
      if (el) {
          isAutoScrollingRef.current = true;
          const top = el.offsetTop - 80;
          mainRef.current?.scrollTo({ top, behavior: 'smooth' });
          setTimeout(() => isAutoScrollingRef.current = false, 800);
      }
  };

  const handleUnlockCategory = (catId: string) => {
      setUnlockedCategoryIds(prev => new Set(prev).add(catId));
  };

  const handleUpdateCategories = (newCats: Category[], newLinks?: LinkItem[]) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      updateData(newLinks || links, newCats);
  };

  const handleDeleteCategory = (catId: string) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      const newCats = categories.filter(c => c.id !== catId);
      const targetId = 'common'; 
      const newLinks = links.map(l => l.categoryId === catId ? { ...l, categoryId: targetId } : l);
      if (newCats.length === 0) newCats.push(DEFAULT_CATEGORIES[0]);
      updateData(newLinks, newCats);
  };

  const handleSaveWebDavConfig = (config: WebDavConfig) => {
      setWebDavConfig(config);
      localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
      updateData(restoredLinks, restoredCategories);
      setIsBackupModalOpen(false);
  };
  
  // Updated Search Logic
  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      
      if (searchMode === 'external') {
          const engine = externalEngines.find(e => e.id === activeEngineId) || externalEngines[0];
          if (engine) {
              window.open(engine.url + encodeURIComponent(searchQuery), '_blank');
              setSearchQuery('');
          }
      }
  };

  const handleUpdateSearchEngines = (newEngines: SearchEngine[]) => {
      setExternalEngines(newEngines);
      localStorage.setItem(SEARCH_ENGINES_KEY, JSON.stringify(newEngines));
  };

  const isCategoryLocked = (catId: string) => {
      const cat = categories.find(c => c.id === catId);
      if (!cat || !cat.password) return false;
      return !unlockedCategoryIds.has(catId);
  };

  const pinnedLinks = useMemo(() => {
      return links.filter(l => l.pinned && !isCategoryLocked(l.categoryId));
  }, [links, categories, unlockedCategoryIds]);

  const searchResults = useMemo(() => {
    // Only filter locally if mode is 'local'
    if (searchMode !== 'local') return links;

    let result = links;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.title.toLowerCase().includes(q) || 
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [links, searchQuery, searchMode]);

  const activeExternalEngine = useMemo(() => {
      return externalEngines.find(e => e.id === activeEngineId) || externalEngines[0];
  }, [externalEngines, activeEngineId]);

  // --- Render Components ---

  const renderLinkCard = (link: LinkItem) => {
      const iconDisplay = link.icon ? (
         <img 
            src={link.icon} 
            alt="" 
            className="w-5 h-5 object-contain" 
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerText = link.title.charAt(0);
            }}
         />
      ) : link.title.charAt(0);
      
      const isSimple = siteSettings.cardStyle === 'simple';

      return (
        <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                let x = e.clientX;
                let y = e.clientY;
                // Boundary adjustment
                if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
                if (y + 220 > window.innerHeight) y = window.innerHeight - 230;
                setContextMenu({ x, y, link });
                return false;
            }}
            className={`group relative flex flex-col ${isSimple ? 'p-2' : 'p-3'} bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-slate-600 hover:-translate-y-0.5 transition-all duration-200 hover:bg-blue-50 dark:hover:bg-slate-750`}
            title={link.description || link.url}
        >
            <div className={`flex items-center gap-3 ${isSimple ? '' : 'mb-1.5'} pr-6`}>
                <div className={`${isSimple ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} rounded-lg bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden`}>
                    {iconDisplay}
                </div>
                <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {link.title}
                </h3>
            </div>
            {!isSimple && (
                <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 h-4 w-full overflow-hidden">
                    {link.description || <span className="opacity-0">.</span>}
                </div>
            )}
        </a>
      );
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      
      {/* Right Click Context Menu */}
      {contextMenu && (
          <div 
             ref={contextMenuRef}
             className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-600 w-44 py-2 flex flex-col animate-in fade-in zoom-in duration-100 overflow-hidden"
             style={{ top: contextMenu.y, left: contextMenu.x }}
             onClick={(e) => e.stopPropagation()}
             onContextMenu={(e) => e.preventDefault()}
          >
             <button onClick={() => { handleCopyLink(contextMenu.link!.url); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Copy size={16} className="text-slate-400"/> <span>复制链接</span>
             </button>
             <button onClick={() => { setQrCodeLink(contextMenu.link); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <QrCode size={16} className="text-slate-400"/> <span>显示二维码</span>
             </button>
             <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
             <button onClick={() => { if(!authToken) setIsAuthOpen(true); else { setEditingLink(contextMenu.link!); setIsModalOpen(true); setContextMenu(null); }}} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Edit2 size={16} className="text-slate-400"/> <span>编辑链接</span>
             </button>
             <button onClick={() => { togglePin(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Pin size={16} className={contextMenu.link!.pinned ? "fill-current text-blue-500" : "text-slate-400"}/> <span>{contextMenu.link!.pinned ? '取消置顶' : '置顶'}</span>
             </button>
             <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
             <button onClick={() => { handleDeleteLink(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-left">
                 <Trash2 size={16}/> <span>删除链接</span>
             </button>
          </div>
      )}

      {/* QR Code Modal */}
      {qrCodeLink && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setQrCodeLink(null)}>
              <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg text-slate-800">{qrCodeLink.title}</h3>
                  <div className="p-2 border border-slate-200 rounded-lg">
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeLink.url)}`} 
                        alt="QR Code" 
                        className="w-48 h-48"
                    />
                  </div>
                  <p className="text-xs text-slate-500 max-w-[200px] truncate">{qrCodeLink.url}</p>
              </div>
          </div>
      )}

      <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />
      
      <CategoryAuthModal 
        isOpen={!!catAuthModalData}
        category={catAuthModalData}
        onClose={() => setCatAuthModalData(null)}
        onUnlock={handleUnlockCategory}
      />

      <CategoryManagerModal 
        isOpen={isCatManagerOpen} 
        onClose={() => setIsCatManagerOpen(false)}
        categories={categories}
        links={links}
        onUpdateCategories={handleUpdateCategories}
        onDeleteCategory={handleDeleteCategory}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        links={links}
        categories={categories}
        onRestore={handleRestoreBackup}
        webDavConfig={webDavConfig}
        onSaveWebDavConfig={handleSaveWebDavConfig}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingLinks={links}
        categories={categories}
        onImport={handleImportConfirm}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={aiConfig}
        siteSettings={siteSettings}
        onSave={handleSaveAIConfig}
        links={links}
        categories={categories}
        onUpdateLinks={(newLinks) => updateData(newLinks, categories)}
      />

      <SearchSettingsModal
        isOpen={isSearchSettingsOpen}
        onClose={() => setIsSearchSettingsOpen(false)}
        engines={externalEngines}
        activeEngineId={activeEngineId}
        onUpdateEngines={handleUpdateSearchEngines}
        onSelectEngine={setActiveEngineId}
      />

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0 gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30 overflow-hidden">
                 {/* 🌟 核心修复点：这里改用前面导入的 myLogo 变量，Vite 编译打包时就会强行把图片打进去，绝对不会找不到路径！ */}
                 <img src={myLogo} alt="Logo" className="w-full h-full object-cover rounded-lg" />
             </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent truncate">
              {siteSettings.navTitle || 'CloudNav'}
            </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
            <button
              onClick={() => scrollToCategory('all')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeCategory === 'all' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="p-1"><Icon name="LayoutGrid" size={18} /></div>
              <span>全部链接</span>
            </button>
            
            <div className="flex items-center justify-between pt-4 pb-2 px-4">
               <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">分类目录</span>
               <button 
                  onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsCatManagerOpen(true); }}
                  className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  title="管理分类"
               >
                  <Settings size={14} />
               </button>
            </div>

            {categories.map(cat => {
                const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
                const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group ${
                      activeCategory === cat.id 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${activeCategory === cat.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {isLocked ? <Lock size={16} className="text-amber-500" /> : (isEmoji ? <span className="text-base leading-none">{cat.icon}</span> : <Icon name={cat.icon} size={16} />)}
                    </div>
                    <span className="truncate flex-1 text-left">{cat.name}</span>
                    {activeCategory === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                  </button>
                );
            })}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div className="grid grid-cols-3 gap-2 mb-2">
                <button 
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                    title="导入书签"
                >
                    <Upload size={14} />
                    <span>导入</span>
                </button>
                <button 
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsBackupModalOpen(true); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                    title="备份与恢复"
                >
                    <CloudCog size={14} />
                    <span>备份</span>
                </button>
                <button 
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                    title="AI 设置"
                >
                    <Settings size={14} />
                    <span>设置</span>
                </button>
            </div>
            
            <div className="flex items-center justify-between text-xs px-2 mt-2">
               <div className="flex items-center gap-1 text-slate-400">
                 {syncStatus === 'saving' && <Loader2 className="animate-spin w-3 h-3 text-blue-500" />}
                 {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                 {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                 {authToken ? <span className="text-green-600">已同步</span> : <span className="text-amber-500">离线</span>}
               </div>
               <a 
                 href={GITHUB_REPO_URL} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                 title="Fork this project on GitHub"
               >
                 <GitFork size={14} />
                 <span>Fork 项目</span>
