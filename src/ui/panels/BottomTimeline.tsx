import { useAppStore } from "../../app/store/appStore";

export function BottomTimeline() {
  const timeline = useAppStore((state) => state.world.timeline);
  const recentTimeline = timeline.slice(-4);
  return (
    <footer className="panel bottom-strip">
      {recentTimeline.map((entry) => (
        <article className="timeline-entry" key={entry.id}>
          <strong>{entry.title}</strong>
          <span>{entry.detail}</span>
        </article>
      ))}
    </footer>
  );
}
