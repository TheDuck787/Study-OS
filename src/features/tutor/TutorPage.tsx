import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui'
import { TutorChat } from './TutorChat'

export default function TutorPage() {
  const [params] = useSearchParams()
  const material = params.get('material')
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Tutor" title="Frag den Tutor" description="Erklärungen in deinem Tempo: super einfach, mit Beispielen oder Schritt für Schritt. Mit deinem Material trennt der Tutor klar, was aus dem Material stammt und was er ergänzt." />
      <TutorChat
        key={params.toString()}
        subjectId={params.get('subject')}
        topicId={params.get('topic')}
        materialIds={material ? [material] : []}
        noteId={params.get('note')}
      />
    </div>
  )
}
