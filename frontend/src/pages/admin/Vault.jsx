import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { api, downloadJson, readFile } from '../../api.js';
import { Alert, Card, Modal, PageHead, useToast } from '../../components/ui.jsx';

export default function Vault() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);

  const backup = async () => {
    setBusy(true);
    try {
      const data = await api('/api/admin/backup');
      downloadJson(`content-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
      toast(`Backup downloaded (${data.mcqs.length} questions, ${data.books.length} books)`, 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const pick = async (e) => {
    try { setPending(JSON.parse(await readFile(e.target.files[0]))); } catch { toast('That file is not a valid backup', 'error'); }
    e.target.value = '';
  };
  const restore = async () => {
    try { await api('/api/admin/restore', { method: 'POST', body: pending }); toast('Content restored', 'success'); setPending(null); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHead title="Snapshot Vault" subtitle="Offline backups of syllabus, books, questions and dictionary" />
      <div className="grid c2">
        <Card title="One-click backup">
          <p className="muted" style={{ marginTop: 0 }}>Downloads one JSON file with all content. Student accounts and payments are not included.</p>
          <button className="btn primary" onClick={backup} disabled={busy}><Download size={16} />Download backup</button>
        </Card>
        <Card title="Restore a snapshot">
          <p className="muted" style={{ marginTop: 0 }}>Upload a saved backup to restore content.</p>
          <input type="file" accept=".json" onChange={pick} />
        </Card>
      </div>
      {pending && (
        <Modal title="Restore this snapshot?" onClose={() => setPending(null)}
          footer={<><button className="btn" onClick={() => setPending(null)}>Cancel</button><button className="btn danger" onClick={restore}><RotateCcw size={15} />Replace all content</button></>}>
          <Alert kind="warn">All current exams, papers, topics, books, questions and dictionary entries will be <b>replaced</b> by the snapshot: {pending.exams?.length ?? 0} exams, {pending.topics?.length ?? 0} topics, {pending.mcqs?.length ?? 0} questions.</Alert>
        </Modal>
      )}
    </div>
  );
}
