import React from 'react';

// Shared building blocks for the "side-by-side, sectioned" form layout used across every
// create/edit page: an uppercase section label + a divider ahead of each logical group of
// fields, so related inputs (e.g. start/end date + duration) sit in a row instead of stacking
// one-per-line all the way down the page.

export function FormSectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function FormSectionDivider() {
  return <div style={{ borderTop: '1px solid #E2E8F0', margin: '20px 0 16px' }} />;
}

// Combines both: <FormSection title="Schedule"><Row>...</Row></FormSection>
export function FormSection({ title, children, first = false }) {
  return (
    <div>
      {!first && <FormSectionDivider />}
      {title && <FormSectionLabel>{title}</FormSectionLabel>}
      {children}
    </div>
  );
}
