import { Routes, Route, Navigate } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { SegmentStudio } from './pages/SegmentStudio'
import { StationList } from './pages/StationList'
import { StationEditor } from './pages/StationEditor'

function App() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/stations" replace />} />
        <Route path="/stations" element={<StationList />} />
        <Route path="/stations/new" element={<StationEditor />} />
        <Route path="/stations/:id" element={<StationEditor />} />
        <Route path="/segments" element={<SegmentStudio />} />
        <Route path="/assembly" element={<AssemblyPlaceholder />} />
      </Routes>
    </div>
  )
}

function AssemblyPlaceholder() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-semibold text-onay-text mb-2">Assembly Dashboard</h1>
      <p className="text-sm text-onay-muted">Coming soon — issue #16</p>
    </div>
  )
}

export default App
