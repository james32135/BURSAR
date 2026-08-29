import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Landing } from '@/pages/Landing'
import { AgentMcp } from '@/pages/AgentMcp'
import { Verify } from '@/pages/Verify'
import { Overview } from '@/pages/app/Overview'
import { Inbox } from '@/pages/app/Inbox'
import { InvoiceDetail } from '@/pages/app/InvoiceDetail'
import { Review } from '@/pages/app/Review'
import { Payments } from '@/pages/app/Payments'
import { Vendors } from '@/pages/app/Vendors'
import { Policies } from '@/pages/app/Policies'
import { AgentPage } from '@/pages/app/Agent'
import { Proof } from '@/pages/app/Proof'
import { Settings } from '@/pages/app/Settings'

const PrivyShell = lazy(() => import('@/components/PrivyShell'))
const OnboardShell = lazy(() => import('@/components/OnboardShell'))

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:id" element={<Verify />} />
        <Route path="/agent" element={<AgentMcp />} />
        <Route
          path="/start"
          element={
            <Suspense fallback={<div className="p-8 font-mono text-sm text-[#71717a]">Opening setup…</div>}>
              <OnboardShell />
            </Suspense>
          }
        />
        <Route
          path="/app"
          element={
            <Suspense fallback={<div className="p-8 font-mono text-sm text-[#71717a]">Opening console…</div>}>
              <PrivyShell />
            </Suspense>
          }
        >
          <Route index element={<Overview />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="inbox/:hash" element={<InvoiceDetail />} />
          <Route path="review" element={<Review />} />
          <Route path="payments" element={<Payments />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="policies" element={<Policies />} />
          <Route path="agent" element={<AgentPage />} />
          <Route path="proof" element={<Proof />} />
          <Route path="proof/:id" element={<Proof />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
