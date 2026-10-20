import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, InputNumber, Spin, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SaveOutlined } from '@ant-design/icons';
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
  infraestructura_id?: number | null;
  infraestructura_nombre?: string;
  infraestructura?: string;
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
  registroId?: number;
  registro_id?: number;
  evento_id?: number;
  eventoId?: number;
  afectacion_variable_id?: number;
  afectacionVariableId?: number;
  variable_id?: number;
  cantidad?: number;
  costo?: number;
  valor?: number;
  activo?: boolean;
  parroquia_id?: number;
  parroquia_nombre?: string;
  evento_nombre?: string;
  evento_sector?: string;
};

type MatrixRow = {
  key: number;
  parroquia_id: number;
  evento: string;
  recinto: string;
  sector?: string;
};

type CellDraft = {
  cantidad: number;
  costo: number;
};

type Props = {
  evento: EventoAfectacionesEvento;
  onDirtyChange?: (hasUnsavedChanges: boolean) => void;
};

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result || record?.registros || record?.detalles || record?.detalle;
  return Array.isArray(candidate) ? candidate as T[] : [];
}

function unwrapObject<T>(payload: unknown): T {
  const record = payload as Record<string, unknown>;
  const data = record?.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data as T : payload as T;
}

function firstPositiveNumber(...values: unknown[]): number {
  for (const value of values) {
    const numericValue = Number(value || 0);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
  }
  return 0;
}

function variableName(variable: AfectacionVariable): string {
  return variable.nombre || variable.descripcion || `Variable ${variable.id}`;
}

function normalId(value: unknown): string {
  return String(value ?? '').trim();
}

function registroVariableId(registro: RegistroApi): number {
  return Number(registro.afectacion_variable_id || registro.afectacionVariableId || registro.variable_id || 0);
}

function registroId(registro?: RegistroApi): string {
  return normalId(registro?.id || registro?.registro_id || registro?.registroId);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
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

export function EventoAfectacionesMatrix({ evento, onDirtyChange }: Props) {
  const { authFetch, datosLogin, selectedEmergenciaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<AfectacionVariable[]>([]);
  const [registros, setRegistros] = useState<RegistroApi[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<AfectacionVariable | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<CellDraft>({ cantidad: 0, costo: 0 });
  const [dirtyVariableIds, setDirtyVariableIds] = useState<Set<number>>(new Set());

  const emergenciaId = firstPositiveNumber(evento.emergencia_id, datosLogin?.emergencia_id, selectedEmergenciaId, localStorage.getItem('selectedEmergenciaId'));
  const provinciaId = firstPositiveNumber(evento.provincia_id, datosLogin?.provincia_id);
  const cantonId = firstPositiveNumber(evento.canton_id, datosLogin?.canton_id);
  const parroquiaId = firstPositiveNumber(evento.parroquia_id, datosLogin?.parroquia_id);
  const coeId = Number(datosLogin?.coe_id || 0);
  const mesaGrupoId = Number(datosLogin?.mesa_grupo_id || datosLogin?.mesa_id || 0);
  const readOnly = Number(datosLogin?.coe_id) === 1;
  const hasUnsavedChanges = dirtyVariableIds.size > 0;

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => () => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

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
      evento: eventName(evento, firstRegistro),
      recinto: evento.infraestructura_nombre || evento.infraestructura || (evento.infraestructura_id ? `Recinto #${evento.infraestructura_id}` : 'Recinto no especificado'),
      sector: firstRegistro?.evento_sector || evento.sector,
    };
  }, [evento, parroquiaId, registros]);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [variablesResponse, registrosResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/mesa_grupo/${mesaGrupoId}/afectacion_varibles/coe/${coeId}`, { method: 'GET' }),
        authFetch(`${API_BASE_URL}/afectacion-variable-registros/evento/${evento.id}`, { method: 'GET' }),
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
        setRegistros(registrosData.filter((registro) => registro.activo !== false));
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
  }, [authFetch, coeId, evento.id, mesaGrupoId]);

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

  const openCell = useCallback((variable: AfectacionVariable) => {
    const registro = registrosByVariable.get(variable.id);
    setSelectedVariable(variable);
    setDraft({ cantidad: Number(registro?.cantidad || 0), costo: Number(registro?.costo ?? registro?.valor ?? 0) });
    setDrawerOpen(true);
  }, [registrosByVariable]);

  const saveMatrix = useCallback(async () => {
    const pendingRegistros = registros.filter((registro) => dirtyVariableIds.has(registroVariableId(registro)));
    if (!pendingRegistros.length) return;

    setSaving(true);
    try {
      const effectiveParroquiaId = matrixRow.parroquia_id || parroquiaId;
      const savedRegistros = await Promise.all(pendingRegistros.map(async (registro) => {
        const variableId = registroVariableId(registro);
        const existingId = registroId(registro);
        const payload = {
          emergencia_id: emergenciaId,
          provincia_id: provinciaId,
          canton_id: cantonId,
          parroquia_id: effectiveParroquiaId,
          evento_id: evento.id,
          afectacion_variable_id: variableId,
          cantidad: Number(registro.cantidad || 0),
          costo: Number(registro.costo ?? registro.valor ?? 0),
          activo: true,
          evento_id_redm: 0,
          afectacion_id_redm: 0,
        };
        const response = await authFetch(`${API_BASE_URL}/afectacion-variable-registros${existingId ? `/${existingId}` : ''}`, {
          method: existingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('No se pudo guardar la matriz de afectaciones.');
        const saved = unwrapObject<RegistroApi>(await readJson<unknown>(response));
        return { ...registro, ...saved, ...payload, id: Number(saved.id || existingId || 0) || undefined };
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
      const isActive = drawerOpen && selectedVariable?.id === variable.id;
      return (
        <button type="button" className={`evento-afectacion-cell${isActive ? ' evento-afectacion-cell--active' : ''}`} aria-label={`Gestionar ${variableName(variable)}`} onClick={() => void openCell(variable)}>
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
  })), [drawerOpen, openCell, registrosByVariable, selectedVariable?.id, variables]);

  const displayedColumns = useMemo<ColumnsType<MatrixRow>>(() => variableColumns.length ? variableColumns : [{
    title: 'Categorias de afectacion',
    key: 'pending-categories',
    width: 520,
    render: () => <div className="evento-afectaciones-placeholder">La matriz aparecera aqui cuando el backend entregue las categorias de afectacion.</div>,
  }], [variableColumns]);

  return (
    <section className="evento-afectaciones-matrix">
      <div className="evento-afectaciones-matrix__toolbar">
        <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={readOnly || loading || !dirtyVariableIds.size} onClick={() => void saveMatrix()}>
          Guardar matriz
        </Button>
        <Typography.Text type="secondary">Registre la cantidad de infraestructura afectada y si posee el dato de estimación del costo por daños ingreselos:</Typography.Text>
      </div>

      {error ? <Alert className="mb-3" type="warning" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        <Table<MatrixRow> bordered size="middle" rowKey="key" scroll={{ x: Math.max(760, variables.length * 230) }} columns={displayedColumns} dataSource={[matrixRow]} pagination={false} />
      </Spin>

      <Drawer width={520} destroyOnHidden title={selectedVariable ? `Evento/Recinto: ${matrixRow.evento} - ${matrixRow.recinto}` : 'Afectacion'} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {selectedVariable ? (
          <div className="evento-afectaciones-drawer-body">
            <div className="evento-afectaciones-editor-card">
              <Typography.Text className="evento-afectaciones-editor-card__title" strong>{variableName(selectedVariable)}</Typography.Text>
              <div className="evento-afectaciones-editor-card__fields">
                <label className="evento-afectaciones-field">
                  <span>Cantidad</span>
                  <InputNumber className="w-100" min={0} disabled={readOnly} value={draft.cantidad} onChange={(value) => updateDraftValue({ ...draft, cantidad: Number(value || 0) })} />
                </label>
                <label className="evento-afectaciones-field">
                  <span>Costo Estimado</span>
                  <InputNumber className="w-100" min={0} precision={2} prefix="$" disabled={readOnly} value={draft.costo} onChange={(value) => updateDraftValue({ ...draft, costo: Number(value || 0) })} />
                </label>
              </div>
            </div>
            <Button onClick={() => setDrawerOpen(false)}>Cerrar</Button>
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}
