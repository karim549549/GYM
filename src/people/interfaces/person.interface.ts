export interface PersonRecord {
  id: string;
  fullName: string;
}

/** A person as another module may show them: the name, and the number they signed up with. */
export interface PersonContact {
  id: string;
  fullName: string;
  phone: string;
}

export interface NewPerson {
  phone: string;
  fullName: string;
  email?: string;
  authUserId: string;
}

export interface CreatedPerson {
  id: string;
}
