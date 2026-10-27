import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, KeyRound } from 'lucide-react';
import { Alert, Button, Card, Input, Modal, Space, Spin, message } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

type UsuarioItem = {
  id: number;
  institucion_id: number;
  usuario: string;
  nombres?: string | null;
  apellidos?: string | null;
  correo?: string | null;
  activo?: boolean | null;
  debe_cambiar_clave?: boolean;
};

type SortKey = keyof Pick<UsuarioItem, 'id' | 'institucion_id' | 'usuario' | 'nombres' | 'apellidos' | 'correo' | 'activo' | 'debe_cambiar_clave'>;
type SortState = { key: SortKey; direction: 'asc' | 'desc' };

const columns: Array<{ key: SortKey; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'usuario', label: 'Usuario' },
  { key: 'nombres', label: 'Nombres' },
  { key: 'apellidos', label: 'Apellidos' },
  { key: 'correo', label: 'Correo' },
  { key: 'institucion_id', label: 'Institución' },
  { key: 'activo', label: 'Estado' },
  { key: 'debe_cambiar_clave', label: 'Cambio pendiente' },
];

function isAdministrator(values: unknown[]) {
  const aliases = ['admin', 'administrador'];
  return values.some((value) => aliases.some((alias) => String(value || '').trim().localeCompare(alias, 'es', { sensitivity: 'base' }) === 0));
}

function compareValues(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left === null || left === undefined || left === '') return 1;
  if (right === null || right === undefined || right === '') return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  return String(left).localeCompare(String(right), 'es', { numeric: true, sensitivity: 'base' });
}

function institutionName(institutionId: number) {
  if (institutionId === 34) return 'CNE';
  if (institutionId === 151) return 'SNGR';
  return String(institutionId);
}

async function responsePayload(response: Response) {
  return response.json().catch(() => ({})) as Promise<{ error?: string }>;
}

export function Usuarios() {
  const { authFetch, datosLogin } = useAuth();
  const admin = isAdministrator([datosLogin?.perfil_nombre, datosLogin?.usuario_login, datosLogin?.usuario, datosLogin?.nombres]);
  const [items, setItems] = useState<UsuarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'usuario', direction: 'asc' });
  const [page, setPage] = useState(1);

  const loadUsers = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/usuarios`);
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los usuarios.');
      setItems(Array.isArray(payload) ? payload as unknown as UsuarioItem[] : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }, [admin, authFetch]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    if (!term) return items;
    return items.filter((item) => [item.id, item.usuario, item.nombres, item.apellidos, item.correo, item.institucion_id, institutionName(item.institucion_id)]
      .some((value) => String(value ?? '').toLocaleLowerCase('es').includes(term)));
  }, [items, search]);

  const sortedItems = useMemo(() => [...filteredItems].sort((left, right) => {
    const leftValue = sort.key === 'institucion_id' ? institutionName(left.institucion_id) : left[sort.key];
    const rightValue = sort.key === 'institucion_id' ? institutionName(right.institucion_id) : right[sort.key];
    const result = compareValues(leftValue, rightValue);
    return sort.direction === 'asc' ? result : -result;
  }), [filteredItems, sort]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const visibleItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleSort(key: SortKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
    setPage(1);
  }

  function confirmReset(item: UsuarioItem) {
    const temporaryPassword = `${item.usuario}2026`;
    Modal.confirm({
      title: `Restablecer contraseña de ${item.usuario}`,
      content: <span>La nueva contraseña temporal será <strong>{temporaryPassword}</strong><br />El usuario deberá cambiarla al ingresar.</span>,
      okText: 'Restablecer',
      cancelText: 'Cancelar',
      okButtonProps: { danger: true },
      onOk: async () => {
        setResettingId(item.id);
        try {
          const response = await authFetch(`${API_BASE_URL}/usuarios/${item.id}/restablecer-clave`, { method: 'POST' });
          const payload = await responsePayload(response);
          if (!response.ok) throw new Error(payload.error || 'No se pudo restablecer la contraseña.');
          setItems((current) => current.map((user) => user.id === item.id ? { ...user, debe_cambiar_clave: true } : user));
          message.success(`Contraseña de ${item.usuario} restablecida a ${temporaryPassword}`);
        } catch (caughtError) {
          message.error(caughtError instanceof Error ? caughtError.message : 'No se pudo restablecer la contraseña.');
          throw caughtError;
        } finally {
          setResettingId(null);
        }
      },
    });
  }

  if (!admin) return <Navigate to="/" replace />;

  return (
    <div className="coe-page usuarios-page">
      <Card className="functional-card maestro-dpa-card base-crud">
        <div className="base-crud__header">
          <div>
            <span className="eyebrow">Administración</span>
            <div className="dpa-title-row">
              <h2 style={{ margin: 0 }}>Usuarios</h2>
              <span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 14 }}>
                Consulte los usuarios registrados y restablezca sus contraseñas temporales.
              </span>
            </div>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void loadUsers()} aria-label="Actualizar usuarios" />
        </div>

        {error ? <Alert className="mb-3" type="error" showIcon message={error} action={<Button size="small" onClick={() => void loadUsers()}>Reintentar</Button>} /> : null}

        <div className="base-crud__toolbar">
          <Input allowClear prefix={<SearchOutlined />} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar" aria-label="Buscar usuarios" />
        </div>

        <Spin spinning={loading}>
          <div className="base-crud__table-wrap">
            <table className="table table-hover align-middle base-crud__table usuarios-page__table">
              <thead><tr>
                {columns.map((column) => (
                  <th key={column.key} aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className={`base-crud__sort${sort.key === column.key ? ' base-crud__sort--active' : ''}`} onClick={() => toggleSort(column.key)}>
                      <span>{column.label}</span>{sort.key === column.key ? (sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown size={13} />}
                    </button>
                  </th>
                ))}
                <th className="text-end">Acción</th>
              </tr></thead>
              <tbody>
                {visibleItems.length ? visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td><td><strong>{item.usuario}</strong></td><td>{item.nombres || '-'}</td><td>{item.apellidos || '-'}</td><td>{item.correo || '-'}</td><td>{institutionName(item.institucion_id)}</td>
                    <td>{item.activo === false ? 'Inactivo' : 'Activo'}</td>
                    <td>{item.debe_cambiar_clave ? 'Sí' : 'No'}</td>
                    <td className="text-end"><Button size="small" icon={<KeyRound size={15} />} loading={resettingId === item.id} onClick={() => confirmReset(item)}>Restablecer</Button></td>
                  </tr>
                )) : <tr><td colSpan={columns.length + 1} className="text-center text-muted py-4">No hay usuarios disponibles.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="base-crud__pagination">
            <span>{filteredItems.length} registros</span>
            <Space><Button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><span>{page} / {totalPages}</span><Button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></Space>
          </div>
        </Spin>
      </Card>
    </div>
  );
}
