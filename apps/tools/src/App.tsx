import { Routes, Route, Navigate } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { SegmentStudio } from './pages/SegmentStudio'
import { StationList } from './pages/StationList'
import { StationEditor } from './pages/StationEditor'
import { AssemblyDashboard } from './pages/AssemblyDashboard'

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
        <Route path="/assembly" element={<AssemblyDashboard />} />
      </Routes>
    </div>
  )
}

export default App
