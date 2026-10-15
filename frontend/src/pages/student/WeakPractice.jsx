import { api } from '../../api.js';
import { Card, Loading, PageHead, useLoad } from '../../components/ui.jsx';
import Protected from '../../components/Protected.jsx';
import PracticeDeck from './PracticeDeck.jsx';
import { useStudent } from './context.jsx';

export default function WeakPractice() {
  const { examId } = useStudent();
  const q = useLoad(() => api(`/api/practice/weak?examId=${examId}&limit=20`), [examId]);
  return (
    <Protected>
      <div className="page" style={{ maxWidth: 820 }}>
        <PageHead title="Weak-area practice" subtitle="Questions you got wrong earlier. Answer them correctly to clear them from this list." />
        <Card>
          <Loading state={q}>{(list) => <PracticeDeck questions={list} />}</Loading>
        </Card>
      </div>
    </Protected>
  );
}
