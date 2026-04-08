export interface UserTypeOption {
  id: number;
  nombre: string;
}

export interface UserRecord {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  id_tipo_usuario: number;
  rol: "admin" | "guardia" | "residente" | "inquilino";
}

export interface UserFormValues {
  nombre: string;
  correo: string;
  password: string;
  telefono: string;
  id_tipo_usuario: string;
}
