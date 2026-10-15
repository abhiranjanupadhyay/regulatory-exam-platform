import { useEffect, useState } from 'react';
import { Field } from '../../components/ui.jsx';

/** Exam -> Paper -> Topic selectors. Calls onChange with { exam, paper, topic } (topic optional). */
export default function CurriculumPicker({ curriculum, onChange, withTopic = true }) {
  const [examId, setExamId] = useState('');
  const [paperId, setPaperId] = useState('');
  const [topicId, setTopicId] = useState('');
  const exam = curriculum.find((e) => e.id === examId);
  const paper = exam?.papers.find((p) => p.id === paperId);
  const topic = paper?.topics.find((t) => t.id === topicId);
  useEffect(() => { onChange({ exam, paper, topic }); }, [examId, paperId, topicId, curriculum]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`grid ${withTopic ? 'c3' : 'c2'}`}>
      <Field label="Exam">
        <select className="input" value={examId} onChange={(e) => { setExamId(e.target.value); setPaperId(''); setTopicId(''); }}>
          <option value="">Select exam</option>{curriculum.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </Field>
      <Field label="Paper">
        <select className="input" value={paperId} disabled={!exam} onChange={(e) => { setPaperId(e.target.value); setTopicId(''); }}>
          <option value="">Select paper</option>{exam?.papers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      {withTopic && (
        <Field label="Topic">
          <select className="input" value={topicId} disabled={!paper} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Select topic</option>{paper?.topics.map((t) => <option key={t.id} value={t.id}>{t.title} (Tier {t.tier})</option>)}
          </select>
        </Field>
      )}
    </div>
  );
}
