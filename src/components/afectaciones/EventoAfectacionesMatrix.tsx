import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Drawer, Empty, InputNumber, Spin, Table, Typography, message } from 'antd';
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

type InfraestructuraRecinto = {
  id: number | string;
  nombre?: string;
  direccion?: string;
  institucion?: string | null;
  latitud?: number;
  longitud?: number;
  tipologia?: string;
};

type InfraestructuraDetalleGuardado = {
  id?: number | string;
  activo?: boolean;
  afectacion_variable_registro_id?: number | string;
  afectacionVariableRegistroId?: number | string;
  infraestructura_id?: number | string;
  infraestructuraId?: number | string;
  costo?: number;
  emergencia_id?: number;
  parroquia_id?: number;
  evento_id?: number;
  afectacion_variable_registro?: {
    id?: number | string;
    afectacion_variable_id?: number | string;
    afectacionVariableId?: number | string;
    variable_id?: number | string;
  };
  infraestructura?: {
    id?: number | string;
  };
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

const RECINTO_INFRAESTRUCTURA_TIPO_ID = 3;

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result || record?.registros || record?.detalles || record?.detalle;
  return Array.isArray(candidate) ? candidate as T[] : [];
}

function unwrapOneOrMany<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const nested = record?.data || record?.items || record?.rows || record?.result;
  if (Array.isArray(nested)) return nested as T[];
  return record && Object.keys(record).length ? [record as T] : [];
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

function detalleRegistroId(detalle: InfraestructuraDetalleGuardado): string {
  return normalId(detalle.afectacion_variable_registro_id || detalle.afectacionVariableRegistroId || detalle.afectacion_variable_registro?.id);
}

function detalleInfraestructuraId(detalle: InfraestructuraDetalleGuardado): string {
  return normalId(detalle.infraestructura_id || detalle.infraestructuraId || detalle.infraestructura?.id);
}

function detalleVariableId(detalle: InfraestructuraDetalleGuardado): number {
  return Number(
    detalle.afectacion_variable_registro?.afectacion_variable_id
    || detalle.afectacion_variable_registro?.afectacionVariableId
    || detalle.afectacion_variable_registro?.variable_id
    || 0,
  );
}

function detalleBelongsToSelection(detalle: InfraestructuraDetalleGuardado, registroIdActual: string, variableIdActual?: number): boolean {
  const registroDetalleId = detalleRegistroId(detalle);
  if (registroIdActual && registroDetalleId === registroIdActual) return true;
  return Boolean(variableIdActual && detalleVariableId(detalle) === variableIdActual);
}

function infraestructuraId(infraestructura: InfraestructuraRecinto): string {
  return normalId(infraestructura.id);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

function usesInfrastructureDetail(variable: AfectacionVariable): boolean {
  const label = variableName(variable).toLowerCase();
  return Boolean(
    variable.es_infraestructura
    || variable.tiene_detalle
    || variable.tiene_detalle_infraestructura
    || variable.requiere_detalle
    || label.includes('recinto')
    || label.includes('infraestructura'),
  );
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
  const [infraestructuras, setInfraestructuras] = useState<InfraestructuraRecinto[]>([]);
  const [selectedInfraestructuraIds, setSelectedInfraestructuraIds] = useState<string[]>([]);
  const [infraDetallesGuardados, setInfraDetallesGuardados] = useState<InfraestructuraDetalleGuardado[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [dirtyVariableIds, setDirtyVariableIds] = useState<Set<number>>(new Set());

  const emergenciaId = firstPositiveNumber(evento.emergencia_id, datosLogin?.emergencia_id, selectedEmergenciaId, localStorage.getItem('selectedEmergenciaId'));
  const provinciaId = firstPositiveNumber(evento.provincia_id, datosLogin?.provincia_id);
  const cantonId = firstPositiveNumber(evento.canton_id, datosLogin?.canton_id);
  const parroquiaId = firstPositiveNumber(evento.parroquia_id, datosLogin?.parroquia_id);
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

  const openCell = useCallback(async (variable: AfectacionVariable) => {
    const registro = registrosByVariable.get(variable.id);
    const effectiveParroquiaId = matrixRow.parroquia_id || parroquiaId;
    setSelectedVariable(variable);
    setDraft({ cantidad: Number(registro?.cantidad || 0), costo: Number(registro?.costo ?? registro?.valor ?? 0) });
    setInfraestructuras([]);
    setSelectedInfraestructuraIds([]);
    setInfraDetallesGuardados([]);
    setDrawerOpen(true);

    if (!usesInfrastructureDetail(variable)) return;
    if (!emergenciaId || !effectiveParroquiaId) {
      message.warning('No se pudo determinar la emergencia o parroquia para cargar recintos electorales.');
      return;
    }
    setDetalleLoading(true);
    try {
      const [infraestructurasResponse, detallesResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/infraestructuras/parroquia/${effectiveParroquiaId}/infraestructura_tipo/${RECINTO_INFRAESTRUCTURA_TIPO_ID}/emergencia/${emergenciaId}`),
        authFetch(`${API_BASE_URL}/afectacion-variable-registro-detalles`),
      ]);
      if (!infraestructurasResponse.ok) throw new Error('No se pudieron cargar los recintos electorales.');
      if (!detallesResponse.ok) throw new Error('No se pudieron cargar los recintos ya registrados.');

      const recintos = unwrapOneOrMany<InfraestructuraRecinto>(await readJson<unknown>(infraestructurasResponse));
      const detalles = unwrapArray<InfraestructuraDetalleGuardado>(await readJson<unknown>(detallesResponse));
      const detallesActivos = detalles.filter((detalle) => detalle.activo !== false);
      const currentRegistroId = registroId(registro);
      const infraestructurasGuardadasActuales = new Set(detallesActivos
        .filter((detalle) => detalleBelongsToSelection(detalle, currentRegistroId, variable.id))
        .map(detalleInfraestructuraId)
        .filter(Boolean));
      const infraestructurasUsadasEnOtrosRegistros = new Set(detallesActivos
        .filter((detalle) => !detalleBelongsToSelection(detalle, currentRegistroId, variable.id))
        .map(detalleInfraestructuraId)
        .filter(Boolean));

      setInfraDetallesGuardados(detallesActivos);
      setSelectedInfraestructuraIds(Array.from(infraestructurasGuardadasActuales));
      setInfraestructuras(recintos.filter((recinto) => infraestructuraId(recinto) && !infraestructurasUsadasEnOtrosRegistros.has(infraestructuraId(recinto))));
    } catch (loadError) {
      message.warning(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los recintos electorales.');
    } finally {
      setDetalleLoading(false);
    }
  }, [authFetch, emergenciaId, evento.id, matrixRow.parroquia_id, parroquiaId, registrosByVariable]);

  const toggleInfraestructura = useCallback((infraestructuraId: string, checked: boolean) => {
    setSelectedInfraestructuraIds((current) => {
      const selected = new Set(current);
      if (checked) selected.add(infraestructuraId);
      else selected.delete(infraestructuraId);
      return Array.from(selected);
    });
  }, []);

  const saveInfraestructuras = useCallback(async () => {
    if (!selectedVariable || !selectedInfraestructuraIds.length) return;
    const parentId = registroId(registrosByVariable.get(selectedVariable.id));
    if (!parentId) {
      message.warning('Primero guarda la matriz para esta variable antes de asociar recintos afectados.');
      return;
    }

    const alreadySavedIds = new Set(infraDetallesGuardados
      .filter((detalle) => detalle.activo !== false && detalleBelongsToSelection(detalle, parentId, selectedVariable.id))
      .map(detalleInfraestructuraId)
      .filter(Boolean));
    const idsToSave = selectedInfraestructuraIds.filter((infraestructuraId) => !alreadySavedIds.has(infraestructuraId));
    if (!idsToSave.length) {
      message.info('No hay recintos nuevos por guardar.');
      return;
    }

    setDetalleLoading(true);
    try {
      const detailResponses = await Promise.all(idsToSave.map((infraestructuraId) => authFetch(`${API_BASE_URL}/afectacion-variable-registro-detalles`, {
        method: 'POST',
        body: JSON.stringify({
          activo: true,
          afectacion_variable_registro_id: Number(parentId),
          costo: Number(draft.costo || 0),
          infraestructura_id: Number(infraestructuraId),
        }),
      })));
      if (detailResponses.some((response) => !response.ok)) throw new Error('No se pudieron guardar todos los recintos afectados.');

      const savedDetails = await Promise.all(detailResponses.map((response) => readJson<unknown>(response).then((payload) => unwrapObject<InfraestructuraDetalleGuardado>(payload))));
      setInfraDetallesGuardados((current) => [...current, ...savedDetails.map((detalle, index) => ({
        ...detalle,
        activo: detalle.activo ?? true,
        afectacion_variable_registro_id: detalle.afectacion_variable_registro_id || parentId,
        infraestructura_id: detalle.infraestructura_id || idsToSave[index],
        costo: detalle.costo ?? Number(draft.costo || 0),
      }))]);
      setSelectedInfraestructuraIds((current) => Array.from(new Set([...current, ...idsToSave])));
      message.success('Recintos afectados guardados correctamente.');
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : 'No se pudieron guardar los recintos afectados.');
    } finally {
      setDetalleLoading(false);
    }
  }, [authFetch, draft.costo, infraDetallesGuardados, registrosByVariable, selectedInfraestructuraIds, selectedVariable]);

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

  const currentRegistroId = selectedVariable ? registroId(registrosByVariable.get(selectedVariable.id)) : '';
  const savedInfraestructuraIdsForCurrentVariable = useMemo(() => new Set(infraDetallesGuardados
    .filter((detalle) => detalle.activo !== false && selectedVariable && detalleBelongsToSelection(detalle, currentRegistroId, selectedVariable.id))
    .map(detalleInfraestructuraId)
    .filter(Boolean)), [currentRegistroId, infraDetallesGuardados, selectedVariable]);
  const pendingInfraestructuraIds = useMemo(() => selectedInfraestructuraIds
    .filter((infraestructuraId) => !savedInfraestructuraIdsForCurrentVariable.has(infraestructuraId)), [savedInfraestructuraIdsForCurrentVariable, selectedInfraestructuraIds]);

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

              {usesInfrastructureDetail(selectedVariable) ? (
                <div className="evento-afectaciones-details">
                  <div className="evento-afectaciones-details__header">
                    <Typography.Title level={5}>Recintos afectados</Typography.Title>
                    {!readOnly ? (
                      <Button type="primary" icon={<SaveOutlined />} disabled={!pendingInfraestructuraIds.length} onClick={saveInfraestructuras}>
                        Guardar recintos afectados
                      </Button>
                    ) : null}
                  </div>
                  <div className="infra-checklist">
                    {infraestructuras.length ? infraestructuras.map((infraestructura) => (
                      <label className="infra-checklist__item" key={infraestructura.id}>
                        <Checkbox
                          disabled={readOnly || savedInfraestructuraIdsForCurrentVariable.has(infraestructuraId(infraestructura))}
                          checked={selectedInfraestructuraIds.includes(infraestructuraId(infraestructura))}
                          onChange={(event) => toggleInfraestructura(infraestructuraId(infraestructura), event.target.checked)}
                        />
                        <span>{infraestructura.nombre || `Recinto ${infraestructura.id}`}</span>
                      </label>
                    )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay recintos disponibles para esta parroquia." />}
                  </div>
                </div>
              ) : null}
            </div>
          </Spin>
        ) : null}
      </Drawer>
    </section>
  );
}
