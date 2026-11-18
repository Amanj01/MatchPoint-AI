'use client';
import { RequireRole } from '@/components/Providers';
import { JobForm } from '@/components/JobForm';

export default function NewJob() {
  return (
    <RequireRole role="employer">
      <div className="page narrow">
        <div className="page-head"><div><h1>Post a job</h1><p className="muted">The AI agent drafts the post; you stay in control of every word.</p></div></div>
        <JobForm />
      </div>
    </RequireRole>
  );
}
