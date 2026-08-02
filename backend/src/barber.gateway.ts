import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class BarberGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('wearable_data')
  handleWearableData(client: Socket, payload: any): void {
    // Rebotar el mensaje a los demás clientes
    this.server.emit('wearable_data_broadcast', payload);
  }

  @SubscribeMessage('sync_appointment')
  handleSyncAppointment(client: Socket, payload: any): void {
    // Rebotar la sincronización de citas del teléfono al reloj
    this.server.emit('sync_appointment_broadcast', payload);
  }

  @SubscribeMessage('wearable_disconnect')
  handleWearableDisconnect(client: Socket): void {
    // Rebotar la desconexión para que el teléfono la detecte
    this.server.emit('wearable_disconnect_broadcast');
  }
}
