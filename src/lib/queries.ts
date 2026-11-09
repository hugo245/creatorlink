import { all, get } from './db';
import type { Order } from './orders';

export type OrderRow = Order & {
  buyer_name: string; buyer_avatar: string | null;
  creator_name: string; creator_avatar: string | null; creator_slug: string;
  last_message: string | null; last_message_at: number | null;
};

const ORDER_SELECT = `
  SELECT o.*, b.username AS buyer_name, b.avatar AS buyer_avatar,
         c.display_name AS creator_name, su.avatar AS creator_avatar, c.slug AS creator_slug,
         (SELECT body FROM messages m WHERE m.order_id = o.id AND m.kind = 'user' ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message,
         (SELECT created_at FROM messages m WHERE m.order_id = o.id AND m.kind = 'user' ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_at
    FROM orders o
    JOIN users b ON b.id = o.buyer_id
    JOIN creators c ON c.id = o.creator_id
    JOIN users su ON su.id = o.seller_user_id`;

export function ordersForUser(userId: string, filter: 'all' | 'open' | 'done' = 'all', limit = 100) {
  const cond = filter === 'open' ? "AND o.status IN ('pending','active','delivered','disputed')" : filter === 'done' ? "AND o.status IN ('completed','cancelled','declined','refunded')" : '';
  return all<OrderRow>(`${ORDER_SELECT} WHERE (o.buyer_id = ? OR o.seller_user_id = ?) ${cond} ORDER BY o.updated_at DESC LIMIT ?`, userId, userId, limit);
}

export function orderDetail(id: string) {
  return get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, id);
}

export type Msg = {
  id: string; sender_id: string | null; sender_name: string | null; sender_avatar: string | null;
  kind: 'user' | 'system'; body: string; file_path: string | null; file_name: string | null; file_type: string | null; created_at: number;
};
export function orderMessages(orderId: string) {
  return all<Msg>(
    `SELECT m.id, m.sender_id, u.username AS sender_name, u.avatar AS sender_avatar, m.kind, m.body, m.file_path, m.file_name, m.file_type, m.created_at
       FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.order_id = ? ORDER BY m.created_at, m.id`,
    orderId,
  );
}
