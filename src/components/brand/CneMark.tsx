type CneMarkProps = { compact?: boolean; light?: boolean };

export function CneMark({ compact = false, light = false }: CneMarkProps) {
  return (
    <div className={`coe-brand ${compact ? 'coe-brand--compact' : ''} ${light ? 'coe-brand--light' : ''}`}>
      <img className="coe-brand__mark" src="/cne-2.png" alt="Consejo Nacional Electoral" />
    </div>
  );
}
