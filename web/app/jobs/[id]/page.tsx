'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { JobDetail } from '@/components/JobDetail';

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <p style={{ marginBottom: 20 }}><Link href={`/jobs?job=${id}`} className="muted small">← Back to jobs</Link></p>
      <JobDetail id={Number(id)} variant="page" />
    </div>
  );
}
