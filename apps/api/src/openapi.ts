export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'School Enquiry & Admission Management API',
    version: '1.0.0',
    description: `
API for managing school enquiries, admissions, and counselling slot bookings.

## Authentication
Most admin endpoints require JWT authentication. Include the token in the Authorization header:
\`Authorization: Bearer <token>\`

## External Integration
The POST /api/enquiry endpoint is designed for external frontend integration and accepts snake_case field names.
    `,
    contact: {
      name: 'API Support',
      email: 'info@nes.edu.in'
    }
  },
  servers: [
    {
      url: 'http://localhost:5002',
      description: 'Development server'
    }
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'OTP', description: 'OTP verification endpoints' },
    { name: 'Enquiry', description: 'Enquiry management endpoints' },
    { name: 'Admission', description: 'Admission management endpoints' },
    { name: 'Slots', description: 'Counselling slot management endpoints' },
    { name: 'Templates', description: 'Form template management endpoints' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check if the API server is running',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Admin login',
        description: 'Authenticate admin user and get JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@school.com' },
                  password: { type: 'string', example: 'admin123' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        user: {
                          type: 'object',
                          properties: {
                            _id: { type: 'string' },
                            username: { type: 'string' },
                            email: { type: 'string' },
                            role: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials'
          }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        description: 'Get the currently authenticated admin user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        _id: { type: 'string' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Not authenticated' }
        }
      }
    },
    '/api/otp/send': {
      post: {
        tags: ['OTP'],
        summary: 'Send OTP',
        description: 'Send OTP to mobile number for verification. In development mode, the OTP is returned in the response.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mobile'],
                properties: {
                  mobile: { type: 'string', example: '+919876543210' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'OTP sent successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    otp: { type: 'string', description: 'Only returned in development mode' }
                  }
                }
              }
            }
          },
          '400': { description: 'Invalid mobile number or cooldown active' }
        }
      }
    },
    '/api/otp/verify': {
      post: {
        tags: ['OTP'],
        summary: 'Verify OTP',
        description: 'Verify the OTP sent to mobile number',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mobile', 'otp'],
                properties: {
                  mobile: { type: 'string', example: '+919876543210' },
                  otp: { type: 'string', example: '123456' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'OTP verified successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { description: 'Invalid or expired OTP' }
        }
      }
    },
    '/api/enquiry': {
      post: {
        tags: ['Enquiry'],
        summary: 'Submit enquiry (External)',
        description: `Submit a new enquiry. This endpoint is designed for external frontend integration.

**Note:** Accepts both snake_case (parent_name) and camelCase (parentName) field names.`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['parent_name', 'child_name', 'mobile', 'email', 'grade'],
                properties: {
                  parent_name: { type: 'string', example: 'Rajesh Kumar' },
                  child_name: { type: 'string', example: 'Arjun Kumar' },
                  mobile: { type: 'string', example: '+919876543210' },
                  email: { type: 'string', format: 'email', example: 'rajesh@email.com' },
                  city: { type: 'string', example: 'Mumbai' },
                  grade: { type: 'string', example: 'Class 5' },
                  message: { type: 'string', example: 'Interested in admission' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Enquiry submitted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        tokenId: { type: 'string', example: 'ENQ-20260110-NES123' },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Missing required fields' }
        }
      }
    },
    '/api/enquiries': {
      get: {
        tags: ['Enquiry'],
        summary: 'List enquiries',
        description: 'Get paginated list of all enquiries (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['new', 'in_progress', 'converted'] } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by token ID, name, or mobile' },
          { name: 'grade', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of enquiries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        enquiries: { type: 'array', items: { $ref: '#/components/schemas/Enquiry' } },
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        totalPages: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/api/enquiry/{id}': {
      get: {
        tags: ['Enquiry'],
        summary: 'Get enquiry details',
        description: 'Get details of a specific enquiry (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Enquiry details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        enquiry: { $ref: '#/components/schemas/Enquiry' },
                        hasAdmission: { type: 'boolean' },
                        admissionId: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { description: 'Enquiry not found' }
        }
      }
    },
    '/api/enquiries/stats/dashboard': {
      get: {
        tags: ['Enquiry'],
        summary: 'Get dashboard stats',
        description: 'Get statistics for admin dashboard (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Dashboard statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        totalEnquiries: { type: 'integer' },
                        enquiriesToday: { type: 'integer' },
                        enquiriesThisMonth: { type: 'integer' },
                        pendingAdmissions: { type: 'integer' },
                        recentEnquiries: { type: 'array', items: { type: 'object' } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/admission/create/{enquiryId}': {
      post: {
        tags: ['Admission'],
        summary: 'Create admission from enquiry',
        description: 'Create a new admission form pre-filled with enquiry data (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'enquiryId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '201': {
            description: 'Admission created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Admission' }
                  }
                }
              }
            }
          },
          '400': { description: 'Admission already exists' },
          '404': { description: 'Enquiry not found' }
        }
      }
    },
    '/api/admission/{id}': {
      get: {
        tags: ['Admission'],
        summary: 'Get admission details',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Admission details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        admission: { $ref: '#/components/schemas/Admission' },
                        slotBooking: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['Admission'],
        summary: 'Update admission',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  studentDob: { type: 'string', format: 'date' },
                  parentAddress: { type: 'string' },
                  parentOccupation: { type: 'string' },
                  emergencyContact: { type: 'string' },
                  status: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected'] },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Admission updated' }
        }
      }
    },
    '/api/admission/{id}/documents': {
      post: {
        tags: ['Admission'],
        summary: 'Upload document',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['document', 'documentType'],
                properties: {
                  document: { type: 'string', format: 'binary' },
                  documentType: { type: 'string', example: 'Birth Certificate' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Document uploaded' }
        }
      }
    },
    '/api/slots': {
      get: {
        tags: ['Slots'],
        summary: 'List slots',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['available', 'full', 'disabled'] } }
        ],
        responses: {
          '200': {
            description: 'List of slots',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Slot' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Slots'],
        summary: 'Create slot',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['date', 'startTime', 'endTime'],
                properties: {
                  date: { type: 'string', format: 'date', example: '2026-01-15' },
                  startTime: { type: 'string', example: '10:00' },
                  endTime: { type: 'string', example: '10:30' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Slot created' },
          '400': { description: 'Slot already exists' }
        }
      }
    },
    '/api/slots/available': {
      get: {
        tags: ['Slots'],
        summary: 'Get available slots',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Available slots',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Slot' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/slots/{id}/book': {
      post: {
        tags: ['Slots'],
        summary: 'Book slot',
        description: 'Book a counselling slot for an admission. Sends calendar invites to parent and principal.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['admissionId'],
                properties: {
                  admissionId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Slot booked successfully' },
          '400': { description: 'Slot not available or already booked' }
        }
      }
    },
    '/api/templates/enquiry': {
      get: {
        tags: ['Templates'],
        summary: 'Get enquiry template',
        responses: {
          '200': {
            description: 'Enquiry form template',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/FormTemplate' }
                  }
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['Templates'],
        summary: 'Update enquiry template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fields: { type: 'array', items: { $ref: '#/components/schemas/FormField' } }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Template updated' }
        }
      }
    },
    '/api/templates/admission': {
      get: {
        tags: ['Templates'],
        summary: 'Get admission template',
        responses: { '200': { description: 'Admission form template' } }
      },
      put: {
        tags: ['Templates'],
        summary: 'Update admission template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fields: { type: 'array', items: { $ref: '#/components/schemas/FormField' } }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Template updated' } }
      }
    },
    '/api/templates/documents': {
      get: {
        tags: ['Templates'],
        summary: 'Get required documents list',
        responses: { '200': { description: 'Documents list' } }
      },
      put: {
        tags: ['Templates'],
        summary: 'Update documents list',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  documents: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        required: { type: 'boolean' },
                        order: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Documents list updated' } }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      Enquiry: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tokenId: { type: 'string', example: 'ENQ-20260110-NES123' },
          parentName: { type: 'string' },
          childName: { type: 'string' },
          mobile: { type: 'string' },
          mobileVerified: { type: 'boolean' },
          email: { type: 'string' },
          city: { type: 'string' },
          grade: { type: 'string' },
          message: { type: 'string' },
          status: { type: 'string', enum: ['new', 'in_progress', 'converted'] },
          whatsappSent: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Admission: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          enquiryId: { type: 'string' },
          tokenId: { type: 'string' },
          studentName: { type: 'string' },
          parentName: { type: 'string' },
          mobile: { type: 'string' },
          email: { type: 'string' },
          grade: { type: 'string' },
          studentDob: { type: 'string', format: 'date' },
          parentAddress: { type: 'string' },
          parentOccupation: { type: 'string' },
          emergencyContact: { type: 'string' },
          documents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                type: { type: 'string' },
                fileName: { type: 'string' },
                filePath: { type: 'string' },
                uploadedAt: { type: 'string', format: 'date-time' }
              }
            }
          },
          status: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected'] },
          notes: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Slot: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          date: { type: 'string', format: 'date' },
          startTime: { type: 'string', example: '10:00' },
          endTime: { type: 'string', example: '10:30' },
          capacity: { type: 'integer', example: 3 },
          bookedCount: { type: 'integer' },
          status: { type: 'string', enum: ['available', 'full', 'disabled'] },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      FormTemplate: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: { type: 'string', enum: ['enquiry', 'admission'] },
          fields: { type: 'array', items: { $ref: '#/components/schemas/FormField' } },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      FormField: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: ['text', 'email', 'tel', 'select', 'textarea', 'date', 'number'] },
          required: { type: 'boolean' },
          options: { type: 'array', items: { type: 'string' } },
          order: { type: 'integer' },
          placeholder: { type: 'string' }
        }
      }
    }
  }
};
