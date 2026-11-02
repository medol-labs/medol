import '@xyflow/react/dist/style.css';
import { MedolStudio } from './app/EventModelingStudio';
import './styles/app.css';

export default function App() {
  return <MedolStudio />;
}

export function PreviewApp() {
  return <MedolStudio previewOnly />;
}

export function EditorApp() {
  return <MedolStudio editorOnly />;
}
