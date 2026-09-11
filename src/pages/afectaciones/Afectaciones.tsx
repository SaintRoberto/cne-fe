import { Card } from 'antd';
import { AfectacionesParroquiasMatrixSidePanel } from '../../components/afectaciones/AfectacionesParroquiasMatrixSidePanel';
import { useAuth } from '../../context/AuthContext';

export function Afectaciones() {
  const { datosLogin } = useAuth();

  return (
    <Card className="functional-card">
      <AfectacionesParroquiasMatrixSidePanel
        cantonId={Number(datosLogin?.canton_id || 901)}
        mesaGrupoId={Number(datosLogin?.mesa_grupo_id || datosLogin?.mesa_id || 0)}
        tableTitle="Matriz de Afectaciones por Parroquia"
      />
    </Card>
  );
}
