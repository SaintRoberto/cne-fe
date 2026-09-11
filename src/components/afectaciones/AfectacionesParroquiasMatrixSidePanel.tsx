import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Drawer, Input, InputNumber, Row, Select, Space, Spin, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SaveOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

type Id = number | string;

type CatalogItem = {
  id?: Id;
  provincia_id?: Id;
  canton_id?: Id;
  parroquia_id?: Id;
  nombre?: string;
  descripcion?: string;
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
  parroquia_id?: number;
  afectacion_variable_id?: number;
  variable_id?: number;
  cantidad?: number;
  valor?: number;
  observacion?: string;
};

type MatrixRow = {
  key: Id;
  parroquia_id: number;
  parroquia: string;
  values: Record<number, number>;
  registros: Record<number, RegistroApi>;
};

type InfraDetalle = {
  id?: number;
  nombre?: string;
  descripcion?: string;
  cantidad?: number;
  observacion?: string;
};

type Props = {
  cantonId?: number;
  mesaGrupoId?: number;
  tableTitle?: string;
};

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result;
  return Array.isArray(candidate) ? candidate as T[] : [];
}

function getId(item: CatalogItem): number {
  return Number(item.id || item.provincia_id || item.canton_id || item.parroquia_id || 0);
}

function getName(item: CatalogItem | AfectacionVariable): string {
  return item.nombre || item.descripcion || String(('id' in item ? item.id : ''));
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

export function AfectacionesParroquiasMatrixSidePanel({
  cantonId,
  mesaGrupoId = 0,
  tableTitle = 'Matriz de Afectaciones por Parroquia',
}: Props) {
  const { authFetch, datosLogin, selectedEmergenciaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provincias, setProvincias] = useState<CatalogItem[]>([]);
  const [cantones, setCantones] = useState<CatalogItem[]>([]);
  const [parroquias, setParroquias] = useState<CatalogItem[]>([]);
  const [variables, setVariables] = useState<AfectacionVariable[]>([]);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [provinciaSel, setProvinciaSel] = useState<number | undefined>(Number(datosLogin?.provincia_id || undefined));
  const [cantonSel, setCantonSel] = useState<number | undefined>(Number(cantonId || datosLogin?.canton_id || undefined));
  const [parroquiasSel, setParroquiasSel] = useState<number[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<MatrixRow | null>(null);
  const [selectedVar, setSelectedVar] = useState<AfectacionVariable | null>(null);
  const [infraDetalles, setInfraDetalles] = useState<InfraDetalle[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const emergenciaId = Number(selectedEmergenciaId || datosLogin?.emergencia_id || localStorage.getItem('selectedEmergenciaId') || 0);
  const coeId = Number(datosLogin?.coe_id || 0);
  const effectiveMesaGrupoId = Number(datosLogin?.mesa_grupo_id || mesaGrupoId || datosLogin?.mesa_id || 0);
  const readOnly = Number(datosLogin?.coe_id) === 1;

  const loadCatalog = useCallback(async <T,>(endpoint: string) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(endpoint);
    return unwrapArray<T>(await readJson<unknown>(response));
  }, [authFetch]);

  useEffect(() => {
    let cancelled = false;
    async function loadBase() {
      if (!emergenciaId) {
        setError('No existe emergencia seleccionada.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [provinciasData, variablesData] = await Promise.all([
          loadCatalog<CatalogItem>(`/provincias/emergencia/${emergenciaId}`),
          loadCatalog<AfectacionVariable>(`/mesa_grupo/${effectiveMesaGrupoId}/afectacion_varibles/coe/${coeId}`),
        ]);
        if (cancelled) return;
        setProvincias(provinciasData);
        setVariables(variablesData.sort((a, b) => Number(a.orden || a.id) - Number(b.orden || b.id)));
      } catch {
        if (!cancelled) setError('No se pudieron cargar provincias o variables de afectación.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBase();
    return () => {
      cancelled = true;
    };
  }, [coeId, effectiveMesaGrupoId, emergenciaId, loadCatalog]);

  useEffect(() => {
    if (!provinciaSel || !emergenciaId) return;
    loadCatalog<CatalogItem>(`/provincia/${provinciaSel}/cantones/emergencia/${emergenciaId}`)
      .then(setCantones)
      .catch(() => setCantones([]));
  }, [emergenciaId, loadCatalog, provinciaSel]);

  useEffect(() => {
    if (!cantonSel || !emergenciaId) return;
    loadCatalog<CatalogItem>(`/canton/${cantonSel}/parroquias/emergencia/${emergenciaId}`)
      .then((data) => {
        setParroquias(data);
        setParroquiasSel((current) => current.length ? current : data.map(getId).filter(Boolean));
      })
      .catch(() => setParroquias([]));
  }, [cantonSel, emergenciaId, loadCatalog]);

  const loadRegistros = useCallback(async () => {
    if (!emergenciaId || !provinciaSel || !cantonSel || !coeId || !effectiveMesaGrupoId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/afectaciones_registros/eventos/emergencia/${emergenciaId}/provincia/${provinciaSel}/canton/${cantonSel}/coe/${coeId}/mesa_grupo/${effectiveMesaGrupoId}/`);
      if (!response.ok) throw new Error('No se pudieron cargar registros de afectaciones');
      const registros = unwrapArray<RegistroApi>(await readJson<unknown>(response));
      const registrosByKey = new Map<string, RegistroApi>();
      registros.forEach((registro) => {
        const parroquiaId = Number(registro.parroquia_id);
        const variableId = Number(registro.afectacion_variable_id || registro.variable_id);
        if (parroquiaId && variableId) registrosByKey.set(`${parroquiaId}-${variableId}`, registro);
      });
      const selectedSet = new Set(parroquiasSel);
      const nextRows = parroquias
        .filter((parroquia) => !selectedSet.size || selectedSet.has(getId(parroquia)))
        .map((parroquia) => {
          const parroquiaId = getId(parroquia);
          const values: Record<number, number> = {};
          const rowRegistros: Record<number, RegistroApi> = {};
          variables.forEach((variable) => {
            const registro = registrosByKey.get(`${parroquiaId}-${variable.id}`);
            values[variable.id] = Number(registro?.cantidad ?? registro?.valor ?? 0);
            if (registro) rowRegistros[variable.id] = registro;
          });
          return {
            key: parroquiaId,
            parroquia_id: parroquiaId,
            parroquia: getName(parroquia),
            values,
            registros: rowRegistros,
          };
        });
      setRows(nextRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar registros de afectaciones');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, cantonSel, coeId, effectiveMesaGrupoId, emergenciaId, parroquias, parroquiasSel, provinciaSel, variables]);

  useEffect(() => {
    void loadRegistros();
  }, [loadRegistros]);

  function updateValue(parroquiaId: number, variableId: number, value: number | null) {
    setRows((current) => current.map((row) => (
      row.parroquia_id === parroquiaId
        ? { ...row, values: { ...row.values, [variableId]: Number(value || 0) } }
        : row
    )));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const requests = rows.flatMap((row) => variables.map((variable) => {
        const existing = row.registros[variable.id];
        const payload = {
          emergencia_id: emergenciaId,
          provincia_id: provinciaSel,
          canton_id: cantonSel,
          parroquia_id: row.parroquia_id,
          coe_id: coeId,
          mesa_grupo_id: effectiveMesaGrupoId,
          afectacion_variable_id: variable.id,
          cantidad: Number(row.values[variable.id] || 0),
          observacion: existing?.observacion || '',
        };
        const existingId = existing?.id || existing?.registro_id;
        return authFetch(`${API_BASE_URL}/afectacion_variable_registros${existingId ? `/${existingId}` : ''}`, {
          method: existingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
      }));
      const responses = await Promise.all(requests);
      if (responses.some((response) => !response.ok)) throw new Error('Algunos registros no se pudieron guardar');
      message.success('Matriz de afectaciones guardada correctamente');
      await loadRegistros();
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : 'No se pudo guardar la matriz');
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(row: MatrixRow, variable: AfectacionVariable) {
    setSelectedRow(row);
    setSelectedVar(variable);
    setDrawerOpen(true);
    setInfraDetalles([]);
    const usesInfra = variable.es_infraestructura || variable.tiene_detalle || variable.tiene_detalle_infraestructura || variable.requiere_detalle;
    if (!usesInfra) return;
    setDetalleLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/afectacion_variable_registro_detalles/emergencia/${emergenciaId}/variable/${variable.id}/parroquia/${row.parroquia_id}`);
      if (response.ok) setInfraDetalles(unwrapArray<InfraDetalle>(await readJson<unknown>(response)));
    } finally {
      setDetalleLoading(false);
    }
  }

  async function saveInfraDetalles() {
    if (!selectedRow || !selectedVar) return;
    setDetalleLoading(true);
    try {
      const responses = await Promise.all(infraDetalles.map((detalle) => authFetch(`${API_BASE_URL}/afectacion_variable_registro_detalles${detalle.id ? `/${detalle.id}` : ''}`, {
        method: detalle.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...detalle,
          emergencia_id: emergenciaId,
          provincia_id: provinciaSel,
          canton_id: cantonSel,
          parroquia_id: selectedRow.parroquia_id,
          afectacion_variable_id: selectedVar.id,
          cantidad: Number(detalle.cantidad || 0),
        }),
      })));
      if (responses.some((response) => !response.ok)) throw new Error('No se pudo guardar el detalle');
      message.success('Detalle guardado correctamente');
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : 'No se pudo guardar el detalle');
    } finally {
      setDetalleLoading(false);
    }
  }

  const columns = useMemo<ColumnsType<MatrixRow>>(() => [
    {
      title: 'Parroquia',
      dataIndex: 'parroquia',
      key: 'parroquia',
      fixed: 'left',
      width: 190,
    },
    ...variables.map((variable) => ({
      title: (
        <span className="matrix-variable-title">
          {getName(variable)}
          {variable.unidad ? <small>{variable.unidad}</small> : null}
        </span>
      ),
      key: String(variable.id),
      width: 170,
      render: (_: unknown, row: MatrixRow) => (
        <InputNumber
          min={0}
          disabled={readOnly}
          value={row.values[variable.id]}
          onChange={(value) => updateValue(row.parroquia_id, variable.id, value)}
          onFocus={() => {
            setSelectedRow(row);
            setSelectedVar(variable);
          }}
          addonAfter={(
            <button type="button" className="matrix-detail-button" onClick={() => openDetail(row, variable)}>
              Detalle
            </button>
          )}
        />
      ),
    })),
  ], [readOnly, variables]);

  return (
    <section className="afectaciones-matrix">
      <div className="base-crud__header">
        <div>
          <span className="eyebrow">Monitoreo territorial</span>
          <Typography.Title level={2}>{tableTitle}</Typography.Title>
        </div>
        <Space>
          <Button onClick={() => void loadRegistros()}>Actualizar</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={readOnly} onClick={saveAll}>Guardar matriz</Button>
        </Space>
      </div>

      {error ? <Alert className="mb-3" type="warning" showIcon message={error} description="Revise VITE_API_URL o disponibilidad del backend." /> : null}

      <Row gutter={16} className="afectaciones-matrix__filters">
        <Col xs={24} md={8}>
          <label>Provincia</label>
          <Select className="w-100" value={provinciaSel} options={provincias.map((item) => ({ value: getId(item), label: getName(item) }))} onChange={(value) => {
            setProvinciaSel(value);
            setCantonSel(undefined);
            setParroquiasSel([]);
          }} />
        </Col>
        <Col xs={24} md={8}>
          <label>Cantón</label>
          <Select className="w-100" value={cantonSel} options={cantones.map((item) => ({ value: getId(item), label: getName(item) }))} onChange={(value) => {
            setCantonSel(value);
            setParroquiasSel([]);
          }} />
        </Col>
        <Col xs={24} md={8}>
          <label>Parroquias</label>
          <Select mode="multiple" className="w-100" value={parroquiasSel} options={parroquias.map((item) => ({ value: getId(item), label: getName(item) }))} onChange={setParroquiasSel} placeholder="Todas" />
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Table bordered size="middle" rowKey="key" scroll={{ x: Math.max(900, 190 + variables.length * 170) }} columns={columns} dataSource={rows} pagination={false} />
      </Spin>

      <Drawer
        width={520}
        title={selectedRow && selectedVar ? `${selectedRow.parroquia} / ${getName(selectedVar)}` : 'Detalle'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" loading={detalleLoading} disabled={readOnly} onClick={saveInfraDetalles}>Guardar</Button>}
      >
        {selectedRow && selectedVar ? (
          <Spin spinning={detalleLoading}>
            <Typography.Paragraph>
              Cantidad registrada: <strong>{selectedRow.values[selectedVar.id] || 0}</strong>
            </Typography.Paragraph>
            <Space direction="vertical" className="w-100">
              {infraDetalles.map((detalle, index) => (
                <div className="infra-detail-row" key={detalle.id || index}>
                  <Input disabled={readOnly} placeholder="Infraestructura / detalle" value={detalle.nombre || detalle.descripcion} onChange={(event) => {
                    const next = [...infraDetalles];
                    next[index] = { ...detalle, nombre: event.target.value, descripcion: event.target.value };
                    setInfraDetalles(next);
                  }} />
                  <InputNumber disabled={readOnly} min={0} value={detalle.cantidad || 0} onChange={(value) => {
                    const next = [...infraDetalles];
                    next[index] = { ...detalle, cantidad: Number(value || 0) };
                    setInfraDetalles(next);
                  }} />
                </div>
              ))}
              {!readOnly ? (
                <Button onClick={() => setInfraDetalles((current) => [...current, { nombre: '', cantidad: 0 }])}>
                  Agregar detalle
                </Button>
              ) : null}
            </Space>
          </Spin>
        ) : null}
      </Drawer>
    </section>
  );
}
