import React from 'react';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import { InspectorSection } from './InspectorSection.js';
import { VariablesManager } from './VariablesManager.js';

export const VariablesSection: React.FC = () => {
  const fields = useTemplateStore((s) => s.template.dataSchema?.fields || []);

  return (
    <InspectorSection
      title="Variables"
      badge={`${fields.length}`}
      defaultOpen={true}
    >
      <div className="py-1">
        <VariablesManager />
      </div>
    </InspectorSection>
  );
};

