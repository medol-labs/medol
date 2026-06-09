import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MedolStudio } from './app/EventModelingStudio';
import './styles/app.css';

export default function App() {
  return (
    <ReactFlowProvider>
      <MedolStudio />
    </ReactFlowProvider>
  );
}
