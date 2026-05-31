import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EventModelingStudio } from './app/EventModelingStudio';
import './styles/app.css';

export default function App() {
  return (
    <ReactFlowProvider>
      <EventModelingStudio />
    </ReactFlowProvider>
  );
}
