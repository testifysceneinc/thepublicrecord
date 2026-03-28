const { useState, useEffect, useMemo, useCallback, useSyncExternalStore } = React;

// Safe access to Motion components
const Motion = window.Motion || {
  motion: {
    div: (props) => <div {...Object.fromEntries(Object.entries(props).filter(([k]) => !['layout', 'initial', 'animate', 'exit', 'transition'].includes(k)))}>{props.children}</div>,
    span: (props) => <span {...Object.fromEntries(Object.entries(props).filter(([k]) => !['layout', 'initial', 'animate', 'exit', 'transition'].includes(k)))}>{props.children}</span>,
  },
  AnimatePresence: ({children}) => children
};
const { motion, AnimatePresence } = Motion;

// Simple profanity filter list
const BANNED_KEYWORDS = [
  'nazi', 'hitler', 'stalin', 'faggot', 'nigger', 'cunt', 'whore', 'slut', 
  'porn', 'sex', 'dick', 'cock', 'pussy', 'asshole', 'fuck', 'shit', 'bitch'
];

const isAppropriate = (name) => {
  if (!name) return false;
  const lowercaseName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !BANNED_KEYWORDS.some(word => lowercaseName.includes(word));
};

// Initialize WebsimSocket and stable collection references
const room = new WebsimSocket();
const candidateCollection = room.collection('candidate_v1');
const voteCollection = room.collection('vote_v1');

// --- Components ---

const FloatingFeedback = ({ x, y, id, onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 1, y: y, x: x, scale: 0.5 }}
      animate={{ opacity: 0, y: y - 100, scale: 1.5 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      onAnimationComplete={() => onComplete(id)}
      className="floating-plus-one"
      style={{ position: 'fixed', left: 0, top: 0 }}
    >
      +1
    </motion.div>
  );
};

const LeaderboardItem = ({ rank, name, votes, totalMax, isTopTen }) => {
  const percentage = totalMax > 0 ? (votes / totalMax) * 100 : 0;
  
  const getRankStyles = (r) => {
    if (r === 1) return 'bg-yellow-500 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.3)]';
    if (r === 2) return 'bg-slate-300 text-slate-900';
    if (r === 3) return 'bg-orange-500 text-slate-900';
    if (r <= 10) return 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/30';
    return 'bg-slate-700/50 text-slate-400 border border-slate-600/30';
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-4 p-3 mb-2 rounded-xl border transition-all ${
        rank <= 3 ? 'bg-slate-800 border-slate-600/50 shadow-lg' : 'bg-slate-800/40 border-slate-700/30'
      } hover:border-indigo-500/50 hover:bg-slate-800/80`}
    >
      <div className={`min-w-[2.25rem] h-9 flex items-center justify-center rounded-lg font-black text-sm ${getRankStyles(rank)}`}>
        {rank}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className={`font-bold truncate ${rank <= 3 ? 'text-white text-base' : 'text-slate-200 text-sm'}`}>
            {name}
          </span>
          <div className="text-right">
            <span className="text-xs font-black text-indigo-400 tabular-nums">{votes}</span>
            <span className="text-[10px] text-slate-500 ml-1 uppercase font-bold tracking-tighter">pts</span>
          </div>
        </div>
        
        {isTopTen && (
          <div className="w-full bg-slate-900/50 h-1.5 rounded-full overflow-hidden border border-slate-700/30">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "circOut" }}
              className={`h-full ${rank <= 3 ? 'bg-gradient-to-r from-indigo-600 to-violet-400' : 'bg-indigo-500/60'}`}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

const App = () => {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [isVoting, setIsVoting] = useState(false);
  const [lastVoteInfo, setLastVoteInfo] = useState({ name: "", timestamp: 0 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState("");

  const COOLDOWN_MS = 20000;

  useEffect(() => {
    let timer;
    if (timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 100));
      }, 100);
    }
    return () => clearInterval(timer);
  }, [timeLeft]);

  const isCooledDown = useMemo(() => {
    if (inputValue.trim() && lastVoteInfo.name && inputValue.trim().toLowerCase() === lastVoteInfo.name.toLowerCase()) {
      const elapsed = Date.now() - lastVoteInfo.timestamp;
      return elapsed < COOLDOWN_MS;
    }
    return false;
  }, [inputValue, lastVoteInfo]);

  // Sync with records using stable collection references
  const candidates = useSyncExternalStore(candidateCollection.subscribe, candidateCollection.getList) || [];
  const votesData = useSyncExternalStore(voteCollection.subscribe, voteCollection.getList) || [];

  const fullLeaderboard = useMemo(() => {
    const consolidated = {};
    const idToNormName = {};

    candidates.forEach(c => {
      if (!c || !c.name) return;
      const norm = c.name.trim().toLowerCase();
      idToNormName[c.id] = norm;
      if (!consolidated[norm]) {
        consolidated[norm] = { name: c.name, count: 0 };
      } else if (c.name !== norm && consolidated[norm].name === norm) {
        consolidated[norm].name = c.name;
      }
    });

    votesData.forEach(v => {
      if (!v || !v.candidate_id) return;
      const norm = idToNormName[v.candidate_id];
      if (norm && consolidated[norm]) {
        consolidated[norm].count += 1;
      }
    });

    return Object.values(consolidated)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [candidates, votesData]);

  const filteredLeaderboard = useMemo(() => {
    if (!leaderboardSearch.trim()) return fullLeaderboard;
    const search = leaderboardSearch.toLowerCase();
    return fullLeaderboard.filter(item => item.name.toLowerCase().includes(search));
  }, [fullLeaderboard, leaderboardSearch]);

  const suggestions = useMemo(() => {
    const val = inputValue.trim().toLowerCase();
    if (!val) return [];
    return fullLeaderboard
      .filter(item => item.name.toLowerCase().includes(val))
      .slice(0, 6);
  }, [fullLeaderboard, inputValue]);

  const maxVotes = fullLeaderboard.length > 0 ? fullLeaderboard[0].count : 0;

  const handleVote = useCallback(async (e) => {
    if (e) e.preventDefault();
    const name = inputValue.trim();
    if (!name || isVoting || isCooledDown) return;

    if (!isAppropriate(name)) {
      setError("This name is not allowed on the leaderboard.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setIsVoting(true);
    setError("");

    try {
      const normalizedInput = name.toLowerCase();
      let candidate = candidates.find(c => c.name && c.name.trim().toLowerCase() === normalizedInput);
      
      if (!candidate) {
        candidate = await candidateCollection.create({ name });
      }

      await voteCollection.create({ candidate_id: candidate.id });

      if (window.confetti) {
        window.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });
      }

      const id = Date.now();
      setFeedbacks(prev => [...prev, { id, x: window.innerWidth / 2, y: window.innerHeight / 2 }]);
      
      setLastVoteInfo({ name: name, timestamp: Date.now() });
      setTimeLeft(COOLDOWN_MS);
      setInputValue("");
    } catch (err) {
      console.error("Voting error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsVoting(false);
    }
  }, [inputValue, isVoting, isCooledDown, candidates]);

  const removeFeedback = (id) => {
    setFeedbacks(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto px-4 py-6 md:py-10 relative">
      <button 
        onClick={() => setShowInfo(true)}
        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-indigo-400 transition-colors z-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      </button>

      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-slate-700 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-indigo-500 text-2xl">∞</span> Infinite Voting
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Welcome! You have the power to vote for <span className="text-indigo-400 font-bold">endless people</span>. If a name isn't listed, type it in to add them!
              </p>
              <button 
                onClick={() => setShowInfo(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-xl shadow-2xl text-center font-bold flex items-center justify-center gap-2 border-2 border-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2">
          Vote <span className="text-indigo-500">ANYTHING!</span>
        </h1>
        <p className="text-slate-400 text-sm">Every vote will count. Who do you want to vote today?</p>
      </header>

      <div className="relative mb-8 z-30">
        <form onSubmit={handleVote}>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Enter a name to vote..."
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl py-4 pl-6 pr-32 text-lg focus:outline-none focus:border-indigo-500 transition-all placeholder-slate-500 text-white shadow-xl"
              maxLength={30}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isVoting || isCooledDown}
              className={`absolute right-2 top-2 bottom-2 px-6 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${
                isCooledDown ? 'bg-slate-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'
              }`}
            >
              {isVoting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 
              : isCooledDown ? <span>{(timeLeft / 1000).toFixed(1)}s</span> : "Vote"}
            </button>
          </div>
        </form>
        
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden overflow-y-auto max-h-60 z-50">
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  onClick={() => {
                    setInputValue(s.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-6 py-3 hover:bg-slate-700/50 flex items-center justify-between group border-b border-slate-700/30 last:border-none"
                >
                  <span className="text-white font-medium group-hover:text-indigo-400">{s.name}</span>
                  <span className="text-[10px] bg-slate-900/50 text-slate-400 px-2 py-1 rounded-md font-bold">{s.count} pts</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {showSuggestions && <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />}
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-slate-800/30 rounded-3xl border border-slate-700/50 p-4 md:p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">Live Rankings</h2>
          <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">{fullLeaderboard.length} candidates</span>
        </div>

        <div className="relative mb-4 px-2">
          <input
            type="text"
            value={leaderboardSearch}
            onChange={(e) => setLeaderboardSearch(e.target.value)}
            placeholder="Search candidates..."
            className="w-full bg-slate-900/40 border border-slate-700/50 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-indigo-500/50 text-white"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {filteredLeaderboard.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <p>No results found.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredLeaderboard.map((item) => (
                <LeaderboardItem
                  key={item.name}
                  rank={item.rank}
                  name={item.name}
                  votes={item.count}
                  totalMax={maxVotes}
                  isTopTen={item.rank <= 10}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {feedbacks.map(f => (
        <FloatingFeedback key={f.id} {...f} onComplete={removeFeedback} />
      ))}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
