import { api } from '../../api.js';
import { useLoad } from '../../components/ui.jsx';

/** Exams with their papers and topics, for the cascading Exam -> Paper -> Topic selectors. */
export function useCurriculum() {
  return useLoad(async () => {
    const exams = await api('/api/exams');
    const syllabi = await Promise.all(exams.map((e) => api(`/api/exams/${e.id}/syllabus`)));
    return exams.map((e, i) => ({ ...e, papers: syllabi[i].papers }));
  });
}
