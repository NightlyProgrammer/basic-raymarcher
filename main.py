import pygame
import moderngl
import numpy as np
import glm
#mabye add motion blur
#have a buffer with the last frame
#render the last buffer and then render the new image on top with 0.75 alpha
#or mix image texture of laste frame with new color;
pygame.init()

pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MAJOR_VERSION,3)
pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MINOR_VERSION,3)
pygame.display.set_mode((1280,720),pygame.OPENGL | pygame.DOUBLEBUF)# |pygame.RESIZABLE)

#make mouse invisible and not able to move out of the window for later camera rotation
pygame.mouse.set_visible(False)
pygame.event.set_grab(True)
ctx = moderngl.create_context()
clock = pygame.time.Clock()

quad_vertex_data = np.array([
    (-1.0, 1),
    (-1.0, -1.0),
    (1.0, 1.0),
    (1.0,-1.0)

],dtype="f4")
quad_vertex_buffer = ctx.buffer(quad_vertex_data)

with open("vertex_shader.vert","r") as file:
    vert = file.read()
with open("fragment_shader.frag","r") as file:
    frag = file.read()

program = ctx.program(vertex_shader=vert,fragment_shader=frag)

vao = ctx.vertex_array(program,[(quad_vertex_buffer,"2f","in_position")])

class Camera:
    def __init__(self,start_position):
        self.pos = start_position
        self.speed = 5
        self.rotation = glm.vec3(0,0,0)
    def update(self,delta):
        #key input
        keys = pygame.key.get_pressed()

        if keys[pygame.K_w]:
            self.pos.x += glm.sin(self.rotation.y)*delta*self.speed
            self.pos.z += glm.cos(self.rotation.y)*delta*self.speed
        if keys[pygame.K_s]:
            self.pos.x -= glm.sin(self.rotation.y)*delta*self.speed
            self.pos.z -= glm.cos(self.rotation.y)*delta*self.speed
        if keys[pygame.K_a]:
            self.pos.x += glm.sin(self.rotation.y-glm.radians(90))*delta*self.speed
            self.pos.z += glm.cos(self.rotation.y-glm.radians(90))*delta*self.speed
        if keys[pygame.K_d]:
            self.pos.x += glm.sin(self.rotation.y+glm.radians(90))*delta*self.speed
            self.pos.z += glm.cos(self.rotation.y+glm.radians(90))*delta*self.speed

        if keys[pygame.K_SPACE]:
            self.pos.y += delta*self.speed
        if keys[pygame.K_LSHIFT]:
            self.pos.y -= delta*self.speed
        #mouse input(moving the camera)
        mouse_x_mov,mouse_y_mov = pygame.mouse.get_rel()
        self.rotation.y += glm.radians(mouse_x_mov)*delta*self.speed
        self.rotation.x += glm.radians(mouse_y_mov)*delta*self.speed
        #limit pitch (x rotation)
        self.rotation.x = min(max(self.rotation.x,glm.radians(-89)),glm.radians(89))
        
camera = Camera(glm.vec3(0,2,-2))
delta = 0
#fullscreen = False
while True:
    for event in pygame.event.get():
        if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
            pygame.quit()
            vao.release()
            quad_vertex_buffer.release()
            program.release()
            ctx.release()
            exit()
        """elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_1:
                fullscreen = not fullscreen
                if fullscreen:
                    print("lal")
                    pygame.display.set_mode((0,0),pygame.OPENGL | pygame.DOUBLEBUF|pygame.FULLSCREEN)
                else:
                    print("lel")
                    pygame.display.set_mode((1280,720),pygame.OPENGL | pygame.DOUBLEBUF)"""
    ctx.clear(1,0,0)

    camera.update(delta)

    program["size"] = pygame.display.get_window_size()
    program["time"] = pygame.time.get_ticks()*0.001
    program["camera_pos"] = camera.pos
    program["camera_rotation"].write(camera.rotation)
    vao.render(mode=moderngl.TRIANGLE_STRIP)

    pygame.display.flip()
    pygame.display.set_caption(str(round(clock.get_fps())))
    delta = clock.tick(60)*0.001