import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Input, Modal, Space, message } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useMenu } from '../../context/MenuContext';

export type CrudColumn<T> = {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
};

export type CrudPermissions = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRead: boolean;
};

type BaseCRUDProps<T extends { id?: number | string }> = {
  title: string;
  items: T[];
  columns: CrudColumn<T>[];
  initialItem: T;
  onSave: (item: T) => Promise<void>;
  onDelete: (id: number | string) => Promise<void>;
  renderForm: (item: T, setItem: (item: T) => void, readonly: boolean) => ReactNode;
  resolveItemForEdit?: (item: T) => Promise<T>;
  itemLabel?: string;
  modalWidth?: number;
};

const defaultPermissions: CrudPermissions = {
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canRead: true,
};

function normalizePermissions(payload: unknown): CrudPermissions {
  const record = Array.isArray(payload) ? payload[0] as Record<string, unknown> : payload as Record<string, unknown>;
  if (!record) return defaultPermissions;
  return {
    canCreate: Boolean(record.crear ?? record.canCreate ?? record.insertar ?? true),
    canEdit: Boolean(record.editar ?? record.canEdit ?? record.actualizar ?? true),
    canDelete: Boolean(record.eliminar ?? record.canDelete ?? true),
    canRead: Boolean(record.leer ?? record.canRead ?? record.ver ?? true),
  };
}

export function BaseCRUD<T extends { id?: number | string }>({
  title,
  items,
  columns,
  initialItem,
  onSave,
  onDelete,
  renderForm,
  resolveItemForEdit,
  itemLabel = 'registro',
  modalWidth = 960,
}: BaseCRUDProps<T>) {
  const { datosLogin, authFetch } = useAuth();
  const { getMenuIdByRoute } = useMenu();
  const location = useLocation();
  const [permissions, setPermissions] = useState<CrudPermissions>(defaultPermissions);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [currentItem, setCurrentItem] = useState<T>(initialItem);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPermissions() {
      const perfilId = datosLogin?.perfil_id;
      const coeId = datosLogin?.coe_id;
      const mesaId = datosLogin?.mesa_id || datosLogin?.mesa_grupo_id;
      const menuId = getMenuIdByRoute(location.pathname);
      if (!perfilId || !coeId || !mesaId || !menuId) {
        setPermissions(defaultPermissions);
        return;
      }
      try {
        const response = await authFetch(`${API_BASE_URL}/opciones/usuario/${perfilId}/coe/${coeId}/mesa/${mesaId}/menu/${menuId}`);
        if (!response.ok) throw new Error('No se pudieron cargar permisos');
        const payload = await response.json();
        if (!cancelled) setPermissions(normalizePermissions(payload));
      } catch {
        if (!cancelled) setPermissions(defaultPermissions);
      }
    }
    void loadPermissions();
    return () => {
      cancelled = true;
    };
  }, [authFetch, datosLogin?.coe_id, datosLogin?.mesa_grupo_id, datosLogin?.mesa_id, datosLogin?.perfil_id, getMenuIdByRoute, location.pathname]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [items, search]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function openItem(item: T, mode: 'read' | 'edit') {
    const resolved = resolveItemForEdit ? await resolveItemForEdit(item) : item;
    setCurrentItem(resolved);
    setReadonly(mode === 'read');
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(currentItem);
      setModalOpen(false);
      message.success(`${itemLabel} guardado correctamente`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : `No se pudo guardar el ${itemLabel}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: T) {
    if (!item.id) return;
    Modal.confirm({
      title: `Eliminar ${itemLabel}`,
      content: 'Esta accion no se puede deshacer.',
      okText: 'Eliminar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        await onDelete(item.id!);
        message.success(`${itemLabel} eliminado correctamente`);
      },
    });
  }

  return (
    <section className="base-crud">
      <div className="base-crud__header">
        <div>
          <span className="eyebrow">Gestion</span>
          <h2>{title}</h2>
        </div>
        {permissions.canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setCurrentItem(initialItem);
            setReadonly(false);
            setModalOpen(true);
          }}>
            Nuevo
          </Button>
        ) : null}
      </div>

      <div className="base-crud__toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Buscar"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="base-crud__table-wrap">
        <table className="table table-hover align-middle base-crud__table">
          <thead>
            <tr>
              {columns.map((column) => <th key={String(column.key)}>{column.header}</th>)}
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length ? visibleItems.map((item, index) => (
              <tr key={String(item.id ?? index)}>
                {columns.map((column) => (
                  <td key={String(column.key)}>
                    {column.render ? column.render(item) : String((item as Record<string, unknown>)[String(column.key)] ?? '')}
                  </td>
                ))}
                <td className="text-end">
                  <Space>
                    {permissions.canRead ? <Button size="small" icon={<EyeOutlined />} onClick={() => openItem(item, 'read')} /> : null}
                    {permissions.canEdit ? <Button size="small" icon={<EditOutlined />} onClick={() => openItem(item, 'edit')} /> : null}
                    {permissions.canDelete ? <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(item)} /> : null}
                  </Space>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={columns.length + 1} className="text-center text-muted py-4">No hay registros disponibles.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="base-crud__pagination">
        <span>{filteredItems.length} registros</span>
        <Space>
          <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
          <span>{page} / {totalPages}</span>
          <Button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</Button>
        </Space>
      </div>

      <Modal
        centered
        destroyOnHidden
        width={modalWidth}
        open={modalOpen}
        title={readonly ? `Ver ${itemLabel}` : currentItem.id ? `Editar ${itemLabel}` : `Nuevo ${itemLabel}`}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={saving}
        okButtonProps={{ disabled: readonly }}
      >
        {renderForm(currentItem, setCurrentItem, readonly)}
      </Modal>
    </section>
  );
}
