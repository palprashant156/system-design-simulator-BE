import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/simulations',
})
export class SimulationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SimulationGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:project')
  handleJoinProject(
    @MessageBody() projectId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`project:${projectId}`);
    this.logger.log(`Client ${client.id} joined room project:${projectId}`);
    return { status: 'joined', projectId };
  }

  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @MessageBody() projectId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`project:${projectId}`);
    this.logger.log(`Client ${client.id} left room project:${projectId}`);
    return { status: 'left', projectId };
  }

  emitSimulationStarted(projectId: string, data: any) {
    this.server.to(`project:${projectId}`).emit('simulation:started', data);
  }

  emitNodeUpdate(projectId: string, data: any) {
    this.server.to(`project:${projectId}`).emit('simulation:node-update', data);
  }

  emitMetrics(projectId: string, data: any) {
    this.server.to(`project:${projectId}`).emit('simulation:metrics', data);
  }

  emitSimulationCompleted(projectId: string, data: any) {
    this.server.to(`project:${projectId}`).emit('simulation:completed', data);
  }
}
