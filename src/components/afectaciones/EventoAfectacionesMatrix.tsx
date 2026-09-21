import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Input, InputNumber, Space, Spin, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

export type EventoAfectacionesEvento = {
  id: number;
  emergencia_id?: number | null;
  provincia_id?: number | null;
  canton_id?: number | null;
  parroquia_id?: number | null;
  provincia_nombre?: string;
  canton_nombre?: string;
  parroquia_nombre?: string;
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
  parroquia_id?: number;
  parroquia_nombre?: string;
  evento_nombre?: string;
  evento_sector?: string;
};

type InfraDetalle = {
  id?: number;
  evento_id?: number;
  nombre?: string;
  descripcion?: string;
  cantidad?: number;
};

type MatrixRow = {
  key: number;
  parroquia_id: number;
  parroquia: string;
  evento: string;
  sector?: string;
};

type CellDraft = {
  cantidad: number;
  costo: number;
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
  return Boolean(variable.es_infraestructura || variable.tiene_detalle || variable.tiene_detalle_infraestructura || variable.requiere_detalle);
}

function eventName(evento: EventoAfectacionesEvento, registro?: RegistroApi): string {
  return registro?.evento_nombre
    || [evento.evento_tipo_nombre, evento.evento_subtipo_nombre].filter(Boolean).join('/')
    || evento.descripcion
    || `Evento #${evento.id}`;
}

function cantidadTone(cantidad: number) {
  if (cantidad <= 0) return 'zero';
  if (cantidad >= 100) return 'danger';
  if (cantidad >= 50) return 'warning';
  return 'primary';
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
  const [draft, setDraft] = useState<CellDraft>({ cantidad: 0, costo: 0 });
  const [infraDetalles, setInfraDetalles] = useState<InfraDetalle[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [dirtyVariableIds, setDirtyVariableIds] = useState<Set<number>>(new Set());

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

  const matrixRow = useMemo<MatrixRow>(() => {
    const firstRegistro = registros[0];
    return {
      key: evento.id,
      parroquia_id: Number(evento.parroquia_id || firstRegistro?.parroquia_id || parroquiaId || 0),
      parroquia: firstRegistro?.parroquia_nombre || evento.parroquia_nombre || 'Parroquia',
      evento: eventName(evento, firstRegistro),
      sector: firstRegistro?.evento_sector || evento.sector,
    };
  }, [evento, parroquiaId, registros]);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [variablesResponse, registrosResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/mesa_grupo/${mesaGrupoId}/afectacion_varibles/coe/${coeId}`, { method: 'GET' }),
        authFetch(`${API_BASE_URL}/afectaciones_registros/eventos/emergencia/${emergenciaId}/provincia/${provinciaId}/canton/${cantonId}/coe/${coeId}/mesa_grupo/${mesaGrupoId}/`, { method: 'GET' }),
      ]);
      const loadErrors: string[] = [];

      if (variablesResponse.ok) {
        const variablesData = unwrapArray<AfectacionVariable>(await readJson<unknown>(variablesResponse));
        setVariables([...variablesData].sort((a, b) => Number(a.orden || a.id) - Number(b.orden || b.id)));
      } else {
        setVariables([]);
        loadErrors.push('No se pudieron cargar las categorias de afectacion.');
      }

      if (registrosResponse.ok) {
        const registrosData = unwrapArray<RegistroApi>(await readJson<unknown>(registrosResponse));
        setRegistros(registrosData.filter((registro) => {
          const registroEventoId = registro.evento_id ?? registro.eventoId;
          return registroEventoId === undefined || Number(registroEventoId) === evento.id;
        }));
        setDirtyVariableIds(new Set());
      } else {
        setRegistros([]);
        setDirtyVariableIds(new Set());
        loadErrors.push('No se pudieron cargar las afectaciones del evento.');
      }

      setError(loadErrors.length ? loadErrors.join(' ') : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la matriz del evento.');
      setVariables([]);
      setRegistros([]);
      setDirtyVariableIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [authFetch, cantonId, coeId, emergenciaId, evento.id, mesaGrupoId, provinciaId]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  const updateDraftValue = useCallback((nextDraft: CellDraft) => {
    if (!selectedVariable) return;
    const effectiveParroquiaId = matrixRow.parroquia_id || parroquiaId;
    setDraft(nextDraft);
    setDirtyVariableIds((current) => new Set(current).add(selectedVariable.id));
    setRegistros((current) => {
      const existing = current.find((registro) => registroVariableId(registro) === selectedVariable.id);
      const nextRegistro: RegistroApi = {
        ...existing,
        evento_id: evento.id,
        afectacion_variable_id: selectedVariable.id,
        parroquia_id: effectiveParroquiaId,
        cantidad: nextDraft.cantidad,
        costo: nextDraft.costo,
      };
      return [...current.filter((registro) => registroVariableId(registro) !== selectedVariable.id), nextRegistro];
    });
  }, [evento.id, matrixRow.parroquia_id, parroquiaId, selectedVariable]);

  const openCell = useCallback(async (variable: AfectacionVariable) => {
    const registro = registrosByVariable.get(variable.id);
    const effectiveParroquiaId = matrixRow.parroquia_id || parroquiaId;
    setSelectedVariable(variable);
    setDraft({ cantidad: Number(registro?.cantidad || 0), costo: Number(registro?.costo ?? registro?.valor ?? 0) });
    setInfraDetalles([]);
    setDrawerOpen(true);

    if (!usesInfrastructureDetail(variable)) return;
    setDetalleLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/afectacion_variable_registro_detalles/emergencia/${emergenciaId}/variable/${variable.id}/parroquia/${effectiveParroquiaId}?evento_id=${evento.id}`);
      if (!response.ok) return;
      const detalles = unwrapArray<InfraDetalle>(await readJson<unknown>(response));
      setInfraDetalles(detalles.filter((detalle) => detalle.evento_id === undefined || Number(detalle.evento_id) === evento.id));
    } finally {
      setDetalleLoading(false);
    }
  }, [authFetch, emergenciaId, evento.id, matrixRow.parroquia_id, parroquiaId, registrosByVariable]);

  const saveMatrix = useCallback(async () => {
    const pendingRegistros = registros.filter((registro) => dirtyVariableIds.has(registroVariableId(registro)));
    if (!pendingRegistros.length) return;

    setSaving(true);
    try {
      const effectiveParroquiaId = matrixRow.parroquia_id || parroquiaId;
      const savedRegistros = await Promise.all(pendingRegistros.map(async (registro) => {
        const variableId = registroVariableId(registro);
        const existingId = registro.id || registro.registro_id;
        const payload = {
          evento_id: evento.id,
          emergencia_id: emergenciaId,
          provincia_id: provinciaId,
          canton_id: cantonId,
          parroquia_id: effectiveParroquiaId,
          coe_id: coeId,
          mesa_grupo_id: mesaGrupoId,
          afectacion_variable_id: variableId,
          cantidad: Number(registro.cantidad || 0),
          costo: Number(registro.costo ?? registro.valor ?? 0),
        };
        const response = await authFetch(`${API_BASE_URL}/afectacion_variable_registros${existingId ? `/${existingId}` : ''}`, {
          method: existingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('No se pudo guardar la matriz de afectaciones.');
        const saved = await readJson<RegistroApi>(response);
        return { ...registro, ...saved, ...payload, id: saved.id || existingId };
      }));

      setRegistros((current) => {
        const savedByVariable = new Map(savedRegistros.map((registro) => [registroVariableId(registro), registro]));
        return [...current.filter((registro) => !savedByVariable.has(registroVariableId(registro))), ...savedRegistros];
      });
      setDirtyVariableIds(new Set());
      message.success('Matriz de afectaciones guardada correctamente.');
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : 'No se pudo guardar la matriz.');
    } finally {
      setSaving(false);
    }
  }, [authFetch, cantonId, coeId, dirtyVariableIds, emergenciaId, evento.id, matrixRow.parroquia_id, mesaGrupoId, parroquiaId, provinciaId, registros]);

  const variableColumns = useMemo<ColumnsType<MatrixRow>>(() => variables.map((variable) => ({
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
      const percent = Math.max(0, Math.min(100, cantidad));
      return (
        <button type="button" className="evento-afectacion-cell" aria-label={`Gestionar ${variableName(variable)}`} onClick={() => void openCell(variable)}>
          <span className="evento-afectacion-cell__metric">
            <small>Cantidad</small>
            <strong className={`evento-afectacion-cell__bar evento-afectacion-cell__bar--${cantidadTone(cantidad)}`}>
              <span style={{ width: `${percent}%` }} />
              <b>{cantidad.toLocaleString('es-EC')}</b>
            </strong>
          </span>
          <span className="evento-afectacion-cell__metric">
            <small>Costo</small>
            <strong className={`evento-afectacion-cell__cost evento-afectacion-cell__cost--${costo > 0 ? 'positive' : 'zero'}`}>
              {costo.toLocaleString('es-EC', { style: 'currency', currency: 'USD' })}
            </strong>
          </span>
        </button>
      );
    },
  })), [openCell, registrosByVariable, variables]);

  const columns = useMemo<ColumnsType<MatrixRow>>(() => [
    {
      title: 'Parroquia / Evento',
      key: 'evento',
      fixed: 'left',
      width: 230,
      render: (_: unknown, row: MatrixRow) => (
        <div className="evento-afectaciones-row-title">
          <strong>{row.parroquia}</strong>
          <span>{row.evento}</span>
          {row.sector ? <small>{row.sector}</small> : null}
        </div>
      ),
    },
    ...variableColumns,
  ], [variableColumns]);

  const displayedColumns = useMemo<ColumnsType<MatrixRow>>(() => variableColumns.length ? columns : [columns[0], {
    title: 'Categorias de afectacion',
    key: 'pending-categories',
    width: 520,
    render: () => <div className="evento-afectaciones-placeholder">La matriz aparecera aqui cuando el backend entregue las categorias de afectacion.</div>,
  }], [columns, variableColumns.length]);

  return (
    <section className="evento-afectaciones-matrix">
      <div className="evento-afectaciones-matrix__toolbar">
        <Typography.Text type="secondary">Selecciona una categoria para registrar o editar su cantidad y costo.</Typography.Text>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={readOnly || loading || !dirtyVariableIds.size} onClick={() => void saveMatrix()}>
          Guardar matriz
        </Button>
      </div>

      {error ? <Alert className="mb-3" type="warning" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        <Table<MatrixRow> bordered size="middle" rowKey="key" scroll={{ x: Math.max(760, 230 + variables.length * 230) }} columns={displayedColumns} dataSource={[matrixRow]} pagination={false} />
      </Spin>

      <Drawer width={520} destroyOnHidden title={selectedVariable ? `Parroquia/Evento: ${matrixRow.parroquia} - ${matrixRow.evento}` : 'Afectacion'} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {selectedVariable ? (
          <Spin spinning={detalleLoading}>
            <div className="evento-afectaciones-drawer-heading">
              <Typography.Text strong>{variableName(selectedVariable)}</Typography.Text>
              {matrixRow.sector ? <Typography.Text type="secondary">Sector: {matrixRow.sector}</Typography.Text> : null}
            </div>
            <Space direction="vertical" size="middle" className="w-100">
              <label className="evento-afectaciones-field">
                <span>Cantidad</span>
                <InputNumber className="w-100" min={0} disabled={readOnly} value={draft.cantidad} onChange={(value) => updateDraftValue({ ...draft, cantidad: Number(value || 0) })} />
              </label>
              <label className="evento-afectaciones-field">
                <span>Costo (USD)</span>
                <InputNumber className="w-100" min={0} precision={2} disabled={readOnly} value={draft.costo} onChange={(value) => updateDraftValue({ ...draft, costo: Number(value || 0) })} />
              </label>

              {usesInfrastructureDetail(selectedVariable) ? (
                <div className="evento-afectaciones-details">
                  <Typography.Title level={5}>Detalle de infraestructura</Typography.Title>
                  {infraDetalles.map((detalle, index) => (
                    <div className="infra-detail-row" key={detalle.id || index}>
                      <Input disabled={readOnly} placeholder="Infraestructura / detalle" value={detalle.nombre || detalle.descripcion} onChange={(event) => setInfraDetalles((current) => current.map((currentDetalle, currentIndex) => currentIndex === index ? { ...currentDetalle, nombre: event.target.value, descripcion: event.target.value } : currentDetalle))} />
                      <InputNumber disabled={readOnly} min={0} value={detalle.cantidad || 0} onChange={(value) => setInfraDetalles((current) => current.map((currentDetalle, currentIndex) => currentIndex === index ? { ...currentDetalle, cantidad: Number(value || 0) } : currentDetalle))} />
                    </div>
                  ))}
                  {!readOnly ? <Button icon={<PlusOutlined />} onClick={() => setInfraDetalles((current) => [...current, { evento_id: evento.id, nombre: '', cantidad: 0 }])}>Agregar detalle</Button> : null}
                </div>
              ) : null}
            </Space>
          </Spin>
        ) : null}
      </Drawer>
    </section>
  );
}
