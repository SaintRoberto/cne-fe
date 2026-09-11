import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Input, InputNumber, Space, Spin, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

type Id = number | string;

export type EventoAfectacionesEvento = {
  id: number;
  emergencia_id?: number | null;
  provincia_id?: number | null;
  canton_id?: number | null;
  parroquia_id?: number | null;
  descripcion?: string;
  sector?: string;
  evento_tipo_nombre?: string;
  evento_subtipo_nombre?: string;
};

type AfectacionVariable = {
  id: number;
  nombre?: string;
  descripcion?: string;
  unidad?: string;
  orden?: number;
  requiere_detalle?: boolean;
  es_infraestructura?: boolean;
  tiene_detalle?: boolean;
  tiene_detalle_infraestructura?: boolean;
};

type RegistroApi = {
  id?: number;
  registro_id?: number;
  evento_id?: number;
  eventoId?: number;
  afectacion_variable_id?: number;
  variable_id?: number;
  cantidad?: number;
  costo?: number;
  valor?: number;
  observacion?: string;
};

type InfraDetalle = {
  id?: number;
  evento_id?: number;
  nombre?: string;
  descripcion?: string;
  cantidad?: number;
  observacion?: string;
};

type MatrixRow = {
  key: number;
};

type CellDraft = {
  cantidad: number;
  costo: number;
  observacion: string;
};

type Props = {
  evento: EventoAfectacionesEvento;
};

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result;
  return Array.isArray(candidate) ? candidate as T[] : [];
}

function variableName(variable: AfectacionVariable): string {
  return variable.nombre || variable.descripcion || `Variable ${variable.id}`;
}

function registroVariableId(registro: RegistroApi): number {
  return Number(registro.afectacion_variable_id || registro.variable_id || 0);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

function usesInfrastructureDetail(variable: AfectacionVariable): boolean {
  return Boolean(
    variable.es_infraestructura
      || variable.tiene_detalle
      || variable.tiene_detalle_infraestructura
      || variable.requiere_detalle,
  );
}

export function EventoAfectacionesMatrix({ evento }: Props) {
  const { authFetch, datosLogin, selectedEmergenciaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<AfectacionVariable[]>([]);
  const [registros, setRegistros] = useState<RegistroApi[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<AfectacionVariable | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<CellDraft>({ cantidad: 0, costo: 0, observacion: '' });
  const [infraDetalles, setInfraDetalles] = useState<InfraDetalle[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const emergenciaId = Number(evento.emergencia_id ?? selectedEmergenciaId ?? datosLogin?.emergencia_id ?? 0);
  const provinciaId = Number(evento.provincia_id ?? datosLogin?.provincia_id ?? 0);
  const cantonId = Number(evento.canton_id ?? datosLogin?.canton_id ?? 0);
  const parroquiaId = Number(evento.parroquia_id ?? datosLogin?.parroquia_id ?? 0);
  const coeId = Number(datosLogin?.coe_id || 0);
  const mesaGrupoId = Number(datosLogin?.mesa_grupo_id || datosLogin?.mesa_id || 0);
  const readOnly = Number(datosLogin?.coe_id) === 1;

  const registrosByVariable = useMemo(() => {
    const map = new Map<number, RegistroApi>();
    registros.forEach((registro) => {
      const variableId = registroVariableId(registro);
      if (variableId) map.set(variableId, registro);
    });
    return map;
  }, [registros]);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const variablesRequest = authFetch(
        `${API_BASE_URL}/mesa_grupo/${mesaGrupoId}/afectacion_varibles/coe/${coeId}`,
      );
      const registrosRequest = authFetch(
        `${API_BASE_URL}/afectaciones_registros/eventos/emergencia/${emergenciaId}/provincia/${provinciaId}/canton/${cantonId}/coe/${coeId}/mesa_grupo/${mesaGrupoId}/?evento_id=${evento.id}`,
      );
      const [variablesResponse, registrosResponse] = await Promise.all([variablesRequest, registrosRequest]);
      const loadErrors: string[] = [];

      if (variablesResponse.ok) {
        const variablesData = unwrapArray<AfectacionVariable>(await readJson<unknown>(variablesResponse));
        setVariables([...variablesData].sort((a, b) => Number(a.orden || a.id) - Number(b.orden || b.id)));
      } else {
        setVariables([]);
        loadErrors.push('No se pudieron cargar las categorías de afectación.');
      }

      if (registrosResponse.ok) {
        const registrosData = unwrapArray<RegistroApi>(await readJson<unknown>(registrosResponse));
        const registrosEvento = registrosData.filter((registro) => {
          const registroEventoId = registro.evento_id ?? registro.eventoId;
          return registroEventoId !== undefined && Number(registroEventoId) === evento.id;
        });
        setRegistros(registrosEvento);
      } else {
        setRegistros([]);
        loadErrors.push('No se pudieron cargar las afectaciones del evento.');
      }

      setError(loadErrors.length ? loadErrors.join(' ') : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la matriz del evento.');
      setVariables([]);
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, cantonId, coeId, emergenciaId, evento.id, mesaGrupoId, provinciaId]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  const openCell = useCallback(async (variable: AfectacionVariable) => {
    const registro = registrosByVariable.get(variable.id);
    setSelectedVariable(variable);
    setDraft({
      cantidad: Number(registro?.cantidad || 0),
      costo: Number(registro?.costo ?? registro?.valor ?? 0),
      observacion: registro?.observacion || '',
    });
    setInfraDetalles([]);
    setDrawerOpen(true);

    if (!usesInfrastructureDetail(variable)) return;
    setDetalleLoading(true);
    try {
      const response = await authFetch(
        `${API_BASE_URL}/afectacion_variable_registro_detalles/emergencia/${emergenciaId}/variable/${variable.id}/parroquia/${parroquiaId}?evento_id=${evento.id}`,
      );
      if (!response.ok) return;
      const detalles = unwrapArray<InfraDetalle>(await readJson<unknown>(response));
      setInfraDetalles(detalles.filter((detalle) => detalle.evento_id === undefined || Number(detalle.evento_id) === evento.id));
    } finally {
      setDetalleLoading(false);
    }
  }, [authFetch, emergenciaId, evento.id, parroquiaId, registrosByVariable]);

  const saveSelectedCell = useCallback(async () => {
    if (!selectedVariable) return;
    if (!Number.isFinite(draft.cantidad) || draft.cantidad < 0) {
      message.error('La cantidad debe ser un número mayor o igual a cero.');
      return;
    }
    if (!Number.isFinite(draft.costo) || draft.costo < 0) {
      message.error('El costo debe ser un número mayor o igual a cero.');
      return;
    }

    setSaving(true);
    try {
      const existing = registrosByVariable.get(selectedVariable.id);
      const existingId = existing?.id || existing?.registro_id;
      const payload = {
        evento_id: evento.id,
        emergencia_id: emergenciaId,
        provincia_id: provinciaId,
        canton_id: cantonId,
        parroquia_id: parroquiaId,
        coe_id: coeId,
        mesa_grupo_id: mesaGrupoId,
        afectacion_variable_id: selectedVariable.id,
        cantidad: draft.cantidad,
        costo: draft.costo,
        observacion: draft.observacion,
      };
      const response = await authFetch(
        `${API_BASE_URL}/afectacion_variable_registros${existingId ? `/${existingId}` : ''}`,
        {
          method: existingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error('No se pudo guardar la afectación del evento.');
      const saved = await readJson<RegistroApi>(response);

      if (usesInfrastructureDetail(selectedVariable) && infraDetalles.length) {
        const detailResponses = await Promise.all(infraDetalles.map((detalle) => authFetch(
          `${API_BASE_URL}/afectacion_variable_registro_detalles${detalle.id ? `/${detalle.id}` : ''}`,
          {
            method: detalle.id ? 'PUT' : 'POST',
            body: JSON.stringify({
              ...detalle,
              evento_id: evento.id,
              emergencia_id: emergenciaId,
              provincia_id: provinciaId,
              canton_id: cantonId,
              parroquia_id: parroquiaId,
              afectacion_variable_id: selectedVariable.id,
              cantidad: Number(detalle.cantidad || 0),
            }),
          },
        )));
        if (detailResponses.some((detailResponse) => !detailResponse.ok)) {
          throw new Error('La afectación se guardó, pero algunos detalles no pudieron guardarse.');
        }
      }

      const nextRegistro: RegistroApi = {
        ...existing,
        ...saved,
        ...payload,
        id: saved.id || existingId,
      };
      setRegistros((current) => {
        const withoutCurrent = current.filter((registro) => registroVariableId(registro) !== selectedVariable.id);
        return [...withoutCurrent, nextRegistro];
      });
      setDrawerOpen(false);
      message.success('Afectación del evento guardada correctamente.');
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : 'No se pudo guardar la afectación.');
    } finally {
      setSaving(false);
    }
  }, [
    authFetch,
    cantonId,
    coeId,
    draft,
    emergenciaId,
    evento.id,
    infraDetalles,
    mesaGrupoId,
    parroquiaId,
    provinciaId,
    registrosByVariable,
    selectedVariable,
  ]);

  const columns = useMemo<ColumnsType<MatrixRow>>(() => variables.map((variable) => ({
    title: (
      <span className="matrix-variable-title">
        {variableName(variable)}
        {variable.unidad ? <small>{variable.unidad}</small> : null}
      </span>
    ),
    key: String(variable.id),
    width: 230,
    render: () => {
      const registro = registrosByVariable.get(variable.id);
      const cantidad = Number(registro?.cantidad || 0);
      const costo = Number(registro?.costo ?? registro?.valor ?? 0);
      return (
        <button
          type="button"
          className="evento-afectacion-cell"
          aria-label={`Gestionar ${variableName(variable)}`}
          onClick={() => void openCell(variable)}
        >
          <span><small>Cantidad</small><strong>{cantidad.toLocaleString('es-EC')}</strong></span>
          <span><small>Costo</small><strong>{costo.toLocaleString('es-EC', { style: 'currency', currency: 'USD' })}</strong></span>
        </button>
      );
    },
  })), [openCell, registrosByVariable, variables]);

  const displayedColumns = useMemo<ColumnsType<MatrixRow>>(() => columns.length ? columns : [{
    title: 'Categorías de afectación',
    key: 'pending-categories',
    width: 520,
    render: () => (
      <div className="evento-afectaciones-placeholder">
        La matriz aparecerá aquí cuando el backend entregue las categorías de afectación.
      </div>
    ),
  }], [columns]);

  return (
    <section className="evento-afectaciones-matrix">
      <div className="evento-afectaciones-matrix__toolbar">
        <Typography.Text type="secondary">
          Selecciona una categoría para registrar o editar su cantidad y costo.
        </Typography.Text>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadMatrix()}>
          Actualizar
        </Button>
      </div>

      {error ? <Alert className="mb-3" type="warning" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        <Table<MatrixRow>
          bordered
          size="middle"
          rowKey="key"
          scroll={{ x: Math.max(520, variables.length * 230) }}
          columns={displayedColumns}
          dataSource={[{ key: evento.id }]}
          pagination={false}
        />
      </Spin>

      <Drawer
        width={520}
        destroyOnHidden
        title={selectedVariable ? variableName(selectedVariable) : 'Afectación'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={(
          <Button type="primary" loading={saving} disabled={readOnly} onClick={() => void saveSelectedCell()}>
            Guardar
          </Button>
        )}
      >
        {selectedVariable ? (
          <Spin spinning={detalleLoading}>
            <Typography.Paragraph type="secondary">
              Evento #{evento.id}{evento.descripcion ? ` — ${evento.descripcion}` : ''}
            </Typography.Paragraph>
            <Space direction="vertical" size="middle" className="w-100">
              <label className="evento-afectaciones-field">
                <span>Cantidad</span>
                <InputNumber
                  className="w-100"
                  min={0}
                  disabled={readOnly}
                  value={draft.cantidad}
                  onChange={(value) => setDraft((current) => ({ ...current, cantidad: Number(value || 0) }))}
                />
              </label>
              <label className="evento-afectaciones-field">
                <span>Costo (USD)</span>
                <InputNumber
                  className="w-100"
                  min={0}
                  precision={2}
                  disabled={readOnly}
                  value={draft.costo}
                  onChange={(value) => setDraft((current) => ({ ...current, costo: Number(value || 0) }))}
                />
              </label>
              <label className="evento-afectaciones-field">
                <span>Observación</span>
                <Input.TextArea
                  rows={3}
                  disabled={readOnly}
                  value={draft.observacion}
                  onChange={(event) => setDraft((current) => ({ ...current, observacion: event.target.value }))}
                />
              </label>

              {usesInfrastructureDetail(selectedVariable) ? (
                <div className="evento-afectaciones-details">
                  <Typography.Title level={5}>Detalle de infraestructura</Typography.Title>
                  {infraDetalles.map((detalle, index) => (
                    <div className="infra-detail-row" key={detalle.id || index}>
                      <Input
                        disabled={readOnly}
                        placeholder="Infraestructura / detalle"
                        value={detalle.nombre || detalle.descripcion}
                        onChange={(event) => setInfraDetalles((current) => current.map((currentDetalle, currentIndex) => (
                          currentIndex === index
                            ? { ...currentDetalle, nombre: event.target.value, descripcion: event.target.value }
                            : currentDetalle
                        )))}
                      />
                      <InputNumber
                        disabled={readOnly}
                        min={0}
                        value={detalle.cantidad || 0}
                        onChange={(value) => setInfraDetalles((current) => current.map((currentDetalle, currentIndex) => (
                          currentIndex === index
                            ? { ...currentDetalle, cantidad: Number(value || 0) }
                            : currentDetalle
                        )))}
                      />
                    </div>
                  ))}
                  {!readOnly ? (
                    <Button icon={<PlusOutlined />} onClick={() => setInfraDetalles((current) => [...current, { evento_id: evento.id, nombre: '', cantidad: 0 }])}>
                      Agregar detalle
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </Space>
          </Spin>
        ) : null}
      </Drawer>
    </section>
  );
}
