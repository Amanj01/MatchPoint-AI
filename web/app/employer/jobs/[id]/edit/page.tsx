'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { RequireRole } from '@/components/Providers';
import { JobForm } from '@/components/JobForm';

export default function EditJob() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => { api<{ job: Job }>(`/jobs/${id}`).then((d) => setJob(d.job)); }, [id]);
  return (
    <RequireRole role="employer">
      <div className="page narrow">
        <div className="page-head"><div><h1>Edit job</h1></div></div>
        {job ? <JobForm job={job} /> : <div className="skeleton" style={{ height: 400 }} />}
      </div>
    </RequireRole>
  );
}
