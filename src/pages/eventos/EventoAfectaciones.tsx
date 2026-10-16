import { useEffect, useState } from 'react';
import { Alert, Breadcrumb, Button, Card, Skeleton, Space, Tag, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { EventoAfectacionesMatrix, type EventoAfectacionesEvento } from '../../components/afectaciones/EventoAfectacionesMatrix';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

type EventoDetalleApi = EventoAfectacionesEvento & {
  evento_fecha?: string;
  fecha_evento?: string;
  evento_causa_nombre?: string;
  evento_origen_nombre?: string;
  provincia_nombre?: string;
  canton_nombre?: string;
  parroquia_nombre?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

export function EventoAfectaciones() {
  const { eventoId: eventoIdParam } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const eventoId = Number(eventoIdParam);
  const invalidEventoId = !Number.isInteger(eventoId) || eventoId <= 0;
  const [evento, setEvento] = useState<EventoDetalleApi | null>(null);
  const [loading, setLoading] = useState(!invalidEventoId);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const blocker = useBlocker(hasUnsavedChanges);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    message.warning('Guarda los cambios de la matriz antes de salir de esta pantalla.');
    blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const preventWindowExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventWindowExit);
    return () => window.removeEventListener('beforeunload', preventWindowExit);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (invalidEventoId) return;
    const controller = new AbortController();
    let cancelled = false;

    async function loadEvento() {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch(`${API_BASE_URL}/eventos/${eventoId}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'El evento solicitado no existe.' : 'No se pudo cargar el evento seleccionado.');
        }
        const data = await readJson<EventoDetalleApi>(response);
        if (!data?.id || Number(data.id) !== eventoId) throw new Error('La respuesta del evento no es válida.');
        if (!cancelled) setEvento({ ...data, id: Number(data.id) });
      } catch (loadError) {
        if (!cancelled && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el evento seleccionado.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEvento();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authFetch, eventoId, invalidEventoId]);

  const eventName = evento
    ? [evento.evento_tipo_nombre, evento.evento_subtipo_nombre].filter(Boolean).join(' / ') || evento.descripcion || `Evento #${evento.id}`
    : '';
  const eventDate = evento?.evento_fecha || evento?.fecha_evento;
  const eventDateLabel = eventDate && dayjs(eventDate).isValid() ? dayjs(eventDate).format('DD/MM/YYYY HH:mm') : '';

  return (
    <section className="evento-afectaciones-page">
      <Breadcrumb
        className="evento-afectaciones-page__breadcrumb"
        items={[
          { title: <Link to="/eventos-adversos">Eventos Adversos</Link> },
          { title: evento ? eventName : 'Gestión de afectaciones' },
        ]}
      />

      {invalidEventoId || error ? (
        <Card className="functional-card">
          <Alert
            type="error"
            showIcon
            message={invalidEventoId ? 'El identificador del evento no es válido.' : error}
            description="Regresa al listado y selecciona nuevamente el evento que deseas gestionar."
            action={<Button onClick={() => navigate('/eventos-adversos')}>Volver al listado</Button>}
          />
        </Card>
      ) : loading || !evento ? (
        <Card className="functional-card"><Skeleton active paragraph={{ rows: 6 }} /></Card>
      ) : (
        <Card className="functional-card">
          <div className="evento-afectaciones-page__header">
            <div>
              <span className="eyebrow">Matriz de Afectaciones</span>
              <Space className="evento-afectaciones-page__tags" size={6}>
                <span className="evento-afectaciones-page__tag-label">Tipo Evento:</span>
                <Tag color="blue">{eventName}</Tag>
                {evento.provincia_nombre ? <Tag>{evento.provincia_nombre}</Tag> : null}
                {evento.canton_nombre ? <Tag>{evento.canton_nombre}</Tag> : null}
                {evento.parroquia_nombre ? <Tag>{evento.parroquia_nombre}</Tag> : null}
                {evento.infraestructura_nombre || evento.infraestructura ? (
                  <Tag color="purple">Recinto: {evento.infraestructura_nombre || evento.infraestructura}</Tag>
                ) : null}
                {evento.sector ? <Tag>Sector: {evento.sector}</Tag> : null}
                {eventDateLabel ? <Tag color="cyan">Fecha: {eventDateLabel}</Tag> : null}
              </Space>
            </div>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/eventos-adversos')}>
              Volver al listado
            </Button>
          </div>

          <EventoAfectacionesMatrix evento={evento} onDirtyChange={setHasUnsavedChanges} />
        </Card>
      )}
    </section>
  );
}
