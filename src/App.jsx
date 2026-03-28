import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppStore } from './store/useAppStore'
import { useAuth } from './hooks/useAuth'
import { useSyncEngine } from './hooks/useSyncEngine'
import { db } from './db/db'
import ArtistList from './components/ArtistList'
import SongLibrary from './components/SongLibrary'
import SetLibrary from './components/SetLibrary'
import SetEditor from './components/SetEditor'
import ShowList from './components/ShowList'
import ShowDetail from './components/ShowDetail'
import SetlistDetail from './components/SetlistDetail'
import Metronome from './components/Metronome'
import PerformanceMode from './components/PerformanceMode'
import SetlistPicker from './components/SetlistPicker'
import Settings from './components/Settings'
import AuthModal from './components/AuthModal'

const MOBILE_NAV = [
  { tab: 'Metronome', icon: 'timer', label: 'TEMPO' },
  { tab: 'Library',   icon: 'library_music', label: 'LIBRARY' },
  { tab: 'Settings',  icon: 'tune', label: 'CONFIG' },
]

export default function App() {
  const {
    currentArtistId, setCurrentArtistId,
    navStack, popView, resetNav,
    performance, setPerformance,
  } = useAppStore()

  const { session, signIn, signOut } = useAuth()
  const { sync, syncState, lastSynced, syncError } = useSyncEngine(session)

  const [activeTab, setActiveTab] = useState('Metronome')
  const [libraryTab, setLibraryTab] = useState('Songs')
  const [showSetlistPicker, setShowSetlistPicker] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const currentArtist = useLiveQuery(
    () => currentArtistId ? db.artists.get(currentArtistId) : null,
    [currentArtistId]
  )

  const currentView = navStack[navStack.length - 1]

  const navigateTo = (tab) => {
    setActiveTab(tab)
    resetNav()
  }

  const handleArtistSelect = (id) => {
    setCurrentArtistId(id)
    resetNav()
    setActiveTab('Library')
    setLibraryTab('Songs')
  }

  const handleBack = () => {
    if (navStack.length > 0) {
      popView()
    } else if (currentArtistId && activeTab === 'Library') {
      setCurrentArtistId(null)
    }
  }

  const enterPerformance = (setlistId) => {
    setShowSetlistPicker(false)
    setPerformance({ active: true, setlistId, songIndex: 0 })
  }

  const exitPerformance = () => {
    setPerformance({ active: false, setlistId: null })
  }

  if (performance.active && performance.setlistId) {
    return <PerformanceMode setlistId={performance.setlistId} onExit={exitPerformance} onExitTo={(tab) => { exitPerformance(); navigateTo(tab) }} />
  }

  const deepView = (() => {
    if (!currentView) return null
    if (currentView.view === 'set-editor')
      return <SetEditor setId={currentView.params.setId} artistId={currentArtistId} />
    if (currentView.view === 'show-detail')
      return <ShowDetail showId={currentView.params.showId} />
    if (currentView.view === 'setlist-detail')
      return <SetlistDetail setlistId={currentView.params.setlistId} artistId={currentArtistId} />
    return null
  })()

  const showBackButton = navStack.length > 0 || (currentArtistId && activeTab === 'Library')

  return (
    <div className="min-h-screen bg-background text-on-background font-body select-none overflow-x-hidden">

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background border-b-4 border-surface-container-low shadow-[inset_0_-2px_4px_rgba(0,0,0,0.8)] flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="p-1.5 text-primary hover:bg-surface-container-high transition-colors rounded mr-1"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <span className="text-xl md:text-2xl font-black tracking-tighter text-primary drop-shadow-[0_0_8px_rgba(255,215,155,0.4)] font-headline">
            SETTEMPO
          </span>
          {currentArtist && activeTab === 'Library' && (
            <span className="hidden md:block text-outline text-sm font-mono-digital truncate">
              · {currentArtist.name}
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {['Metronome', 'Library', 'Settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => navigateTo(tab)}
              className={`font-headline uppercase tracking-widest text-xs font-bold transition-colors pb-1 ${
                activeTab === tab && !deepView
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-outline hover:text-primary/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Header actions */}
        <div className="flex items-center gap-1">
          {currentArtistId && (
            <button
              onClick={() => setShowSetlistPicker(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#9B2226] text-white text-xs font-headline font-bold uppercase tracking-wider rounded hover:brightness-110 transition-all mr-2"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              Perform
            </button>
          )}
          <button
            onClick={() => setShowAuthModal(true)}
            className="p-2 hover:bg-surface-container-high transition-all rounded relative"
            title={session ? session.user.email : 'Sign in'}
          >
            <span className={`material-symbols-outlined ${session ? 'text-primary' : 'text-outline'}`}>sensors</span>
            {session && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_6px_#FFB300]" />
            )}
          </button>
          {session && (
            <button
              onClick={signOut}
              className="p-2 text-outline hover:text-error hover:bg-surface-container-high transition-all rounded"
              title="Sign out"
            >
              <span className="material-symbols-outlined">power_settings_new</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="pt-16 pb-24 md:pb-10 min-h-screen">
        {deepView ? (
          <div className="px-4 md:px-12 max-w-6xl mx-auto pt-6">{deepView}</div>
        ) : (
          <>
            {activeTab === 'Metronome' && <Metronome />}

            {activeTab === 'Library' && (
              <div className="px-4 md:px-12 max-w-6xl mx-auto pt-6">
                {!currentArtistId ? (
                  <ArtistList
                    onSelect={handleArtistSelect}
                    onEngage={(id) => { setCurrentArtistId(id); setShowSetlistPicker(true) }}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-1 border-b border-surface-container-high mb-6">
                      {['Songs', 'Sets', 'Shows'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setLibraryTab(t)}
                          className={`px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest transition-colors ${
                            libraryTab === t
                              ? 'text-primary border-b-2 border-primary'
                              : 'text-outline hover:text-primary/70'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowSetlistPicker(true)}
                        className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-[#9B2226] text-white text-xs font-headline font-bold uppercase tracking-wider rounded md:hidden"
                      >
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                        Perform
                      </button>
                    </div>
                    {libraryTab === 'Songs' && <SongLibrary artistId={currentArtistId} onLoadSong={() => navigateTo('Metronome')} />}
                    {libraryTab === 'Sets' && <SetLibrary artistId={currentArtistId} />}
                    {libraryTab === 'Shows' && <ShowList artistId={currentArtistId} />}
                  </>
                )}
              </div>
            )}

            {activeTab === 'Settings' && (
              <div className="px-4 md:px-12 max-w-6xl mx-auto pt-6">
                <Settings currentArtistId={currentArtistId} />
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-20 bg-surface-container-low border-t-2 border-surface-container-highest flex justify-around items-center px-4">
        {MOBILE_NAV.map(({ tab, icon, label }) => (
          <button
            key={tab}
            onClick={() => navigateTo(tab)}
            className={`flex flex-col items-center justify-center gap-1 w-20 py-2 transition-all ${
              activeTab === tab && !deepView
                ? 'text-primary border-t-4 border-primary bg-surface-container-high/40 -mt-0.5'
                : 'text-on-surface-variant/40'
            }`}
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span className="font-headline font-bold text-[9px] tracking-widest uppercase">{label}</span>
          </button>
        ))}
      </nav>

      {showSetlistPicker && currentArtistId && (
        <SetlistPicker
          artistId={currentArtistId}
          onPick={enterPerformance}
          onClose={() => setShowSetlistPicker(false)}
        />
      )}

      {showAuthModal && (
        <AuthModal
          session={session}
          onSignIn={signIn}
          onSignOut={signOut}
          onClose={() => setShowAuthModal(false)}
          onSync={sync}
          syncState={syncState}
          lastSynced={lastSynced}
          syncError={syncError}
        />
      )}
    </div>
  )
}
